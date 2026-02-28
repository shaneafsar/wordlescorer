import * as Sentry from '@sentry/cloudflare';
import type { AtpAgent } from '@atproto/api';
import type { AppBskyFeedPost } from '@atproto/api';
import {
  type MastoClient, type MastoStatus, type MastoNotification,
  createMastoClient, fetchNotifications, fetchRelationships,
  postStatus as mastoPostStatus, fetchContext, followAccount, fetchHashtagTimeline,
} from './mastodon';
import {
  createBskyAgent, pollNotifications, markNotificationsSeen,
  searchWordlePosts, postReply, getParentPost,
  getAltTextsFromEmbed, buildReplyRef,
} from './bluesky';
import { processWordlePost, processGlobalScoreOnly, type ProcessPostInput } from './process-post';
import { postDailyTopScore, postDailyGlobalStats } from './daily-post';
import { stripHtml } from './util';
import { hasAnalyzedPost } from './db';
import WordleSource from './shared/enum/WordleSource';

export interface Env {
  DB: D1Database;
  BOT_MANAGER: DurableObjectNamespace;
  MASTO_URI: string;
  MASTO_ACCESS_TOKEN: string;
  BSKY_USERNAME: string;
  BSKY_PASSWORD: string;
  /** Set to "false" to enable live replies. Defaults to dry-run (observe only). */
  DRY_RUN?: string;
  /** Bearer token for authenticating /bot/start, /bot/stop, /bot/daily */
  BOT_SECRET?: string;
  SENTRY_DSN?: string;
}

const ALARM_INTERVAL_MS = 30_000;

/** DRY_RUN defaults to true — must explicitly set DRY_RUN=false to post live replies */
function isDryRun(env: Env): boolean {
  return env.DRY_RUN?.toLowerCase() !== 'false';
}

class BotManagerBase implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  private PROCESSING = new Set<string>();
  private PROCESSED = new Set<string>();

  private mastoClient: MastoClient | null = null;
  private bskyAgent: AtpAgent | null = null;

  private get dryRun(): boolean {
    return isDryRun(this.env);
  }

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/status') {
      const alarm = await this.state.storage.getAlarm();
      const mastoSinceId = await this.state.storage.get<string>('mastoSinceId');
      const mastoTagSinceId = await this.state.storage.get<string>('mastoTagSinceId');
      return Response.json({
        status: alarm ? 'polling' : 'stopped',
        dryRun: this.dryRun,
        nextAlarm: alarm ? new Date(alarm).toISOString() : null,
        mastoSinceId,
        mastoTagSinceId,
        processingCount: this.PROCESSING.size,
        processedCount: this.PROCESSED.size,
      });
    }

    if (url.pathname === '/start') {
      const existing = await this.state.storage.getAlarm();
      if (!existing) {
        await this.state.storage.setAlarm(Date.now() + 1000);
      }
      return Response.json({ status: 'started' });
    }

    if (url.pathname === '/stop') {
      await this.state.storage.deleteAlarm();
      this.mastoClient = null;
      this.bskyAgent = null;
      return Response.json({ status: 'stopped' });
    }

    if (url.pathname === '/daily') {
      await this.ensureClients();
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const topResult = await postDailyTopScore(this.env.DB, this.mastoClient, this.bskyAgent, yesterday, this.dryRun);
      const statsResult = await postDailyGlobalStats(this.env.DB, this.mastoClient, this.bskyAgent, yesterday, this.dryRun);
      return Response.json({ dryRun: this.dryRun, topScorer: topResult, globalStats: statsResult });
    }

    return new Response('Not found', { status: 404 });
  }

  async alarm(): Promise<void> {
    try {
      await this.ensureClients();
      await this.pollMastodon();
      await this.pollBluesky();
    } catch (e) {
      console.error('[bot] Alarm error:', e);
    }

    // Prune PROCESSED set to prevent unbounded growth
    if (this.PROCESSED.size > 10000) {
      this.PROCESSED.clear();
    }

    // Schedule next alarm
    await this.state.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
  }

  private async ensureClients(): Promise<void> {
    if (!this.mastoClient && this.env.MASTO_URI && this.env.MASTO_ACCESS_TOKEN) {
      this.mastoClient = createMastoClient(this.env.MASTO_URI, this.env.MASTO_ACCESS_TOKEN);
      console.log(`[bot] Mastodon client initialized (${this.env.MASTO_URI})`);
    }
    if (!this.bskyAgent && this.env.BSKY_USERNAME && this.env.BSKY_PASSWORD) {
      try {
        this.bskyAgent = await createBskyAgent(this.env.BSKY_USERNAME, this.env.BSKY_PASSWORD);
        console.log('[bot] Bluesky agent authenticated');
      } catch (e) {
        console.error('[bot] Failed to authenticate Bluesky:', e);
      }
    }
  }

  // ── Mastodon Polling ──

  private async pollMastodon(): Promise<void> {
    if (!this.mastoClient) return;

    try {
      // 1. Poll notifications (mentions + follows)
      await this.pollMastoNotifications();

      // 2. Poll #Wordle hashtag timeline
      await this.pollMastoHashtagTimeline();
    } catch (e) {
      console.error('[bot:masto] Poll error:', e);
    }
  }

  private async pollMastoNotifications(): Promise<void> {
    const client = this.mastoClient!;
    const sinceId = await this.state.storage.get<string>('mastoSinceId');

    const notifs = await fetchNotifications(client, sinceId || undefined);
    console.log(`[bot:masto] Fetched ${notifs.length} notifications (sinceId: ${sinceId || 'none'})`);

    let maxId = sinceId || '';
    for (const notif of notifs) {
      if (!maxId || BigInt(notif.id) > BigInt(maxId)) maxId = notif.id;

      if (notif.type === 'follow') {
        if (this.dryRun) {
          console.log(`[bot:masto] [DRY RUN] Would follow back ${notif.account.acct}`);
        } else {
          try {
            await followAccount(client, notif.account.id);
          } catch (e) {
            console.error('[bot:masto] Failed to follow back:', e);
          }
        }
        continue;
      }

      if (notif.type === 'mention' && notif.status) {
        await this.processMastoPost(notif.status, false);
      }
    }

    if (maxId && maxId !== sinceId) {
      await this.state.storage.put('mastoSinceId', maxId);
    }
  }

  private async pollMastoHashtagTimeline(): Promise<void> {
    const client = this.mastoClient!;
    const sinceId = await this.state.storage.get<string>('mastoTagSinceId');

    const statuses = await fetchHashtagTimeline(client, 'Wordle', sinceId || undefined);
    console.log(`[bot:masto] Fetched ${statuses.length} #Wordle timeline posts (sinceId: ${sinceId || 'none'})`);
    if (statuses.length === 0) return;

    // Batch relationship lookup — one API call instead of N
    const uniqueAccountIds = [...new Set(statuses.map(s => s.account.id))];
    const relationships = await fetchRelationships(client, uniqueAccountIds);
    const followerMap = new Map(relationships.map(r => [r.id, r.followedBy]));

    let maxId = sinceId || '';
    for (const status of statuses) {
      if (!maxId || BigInt(status.id) > BigInt(maxId)) maxId = status.id;

      const isFollowingBot = followerMap.get(status.account.id) || false;

      const acct = status.account.acct;
      const userId = acct.includes('@') ? acct : acct + '@mastodon.social';
      const screenName = '@' + acct;

      if (isFollowingBot) {
        // Full processing for followers
        await this.processMastoPost(status, false);
      } else {
        // Global scores only for non-followers
        const textContent = stripHtml(status.content) || '';
        const altTexts = status.media_attachments.map(m => m.description || '');
        await processGlobalScoreOnly(this.env.DB, {
          text: textContent, altTexts, authorId: userId,
          screenName, url: status.url || '', source: WordleSource.Mastodon,
        });
      }
    }

    if (maxId && maxId !== sinceId) {
      await this.state.storage.put('mastoTagSinceId', maxId);
    }
  }

  private async processMastoPost(status: MastoStatus, isGrowth: boolean): Promise<void> {
    const client = this.mastoClient!;
    const acct = status.account.acct;
    const userId = acct.includes('@') ? acct : acct + '@mastodon.social';
    const screenName = '@' + acct;
    const textContent = stripHtml(status.content) || '';
    const altTexts = status.media_attachments.map(m => m.description || '');

    const input: ProcessPostInput = {
      text: textContent,
      altTexts,
      postId: status.id,
      authorId: userId,
      screenName,
      url: status.url || '',
      createdAt: status.created_at,
      source: WordleSource.Mastodon,
      isGrowth,
      photo: status.account.avatar,
      parentPostFetcher: status.in_reply_to_id ? async () => {
        try {
          const context = await fetchContext(client, status.id);
          const parent = context.ancestors[context.ancestors.length - 1];
          if (parent) {
            const pAcct = parent.account.acct;
            return {
              text: stripHtml(parent.content) || '',
              altTexts: parent.media_attachments.map(m => m.description || ''),
              postId: parent.id,
              authorId: pAcct.includes('@') ? pAcct : pAcct + '@mastodon.social',
              screenName: '@' + pAcct,
              url: parent.url || '',
              createdAt: parent.created_at,
              source: WordleSource.Mastodon,
              isGrowth: false,
              photo: parent.account.avatar,
            };
          }
        } catch (e) {
          console.error('[bot:masto] Error fetching parent:', e);
        }
        return null;
      } : undefined,
    };

    const result = await processWordlePost(this.env.DB, input, this.PROCESSING, this.PROCESSED);

    if (result?.shouldReply) {
      if (this.dryRun) {
        console.log(`[bot:masto] [DRY RUN] Would reply to ${status.id}: ${result.replyText}`);
      } else {
        try {
          await mastoPostStatus(client, result.replyText, status.id);
          console.log(`[bot:masto] Reply to ${status.id}: ${result.replyText}`);
        } catch (e) {
          console.error('[bot:masto] Failed to reply:', e);
        }
      }
    }
  }

  // ── Bluesky Polling ──

  private async pollBluesky(): Promise<void> {
    if (!this.bskyAgent) return;

    try {
      // 1. Poll notifications
      await this.pollBskyNotifications();

      // 2. Search for wordle posts
      await this.pollBskySearch();
    } catch (e) {
      console.error('[bot:bsky] Poll error:', e);
    }
  }

  private async pollBskyNotifications(): Promise<void> {
    const agent = this.bskyAgent!;
    const { mentions, lastSeenAt } = await pollNotifications(agent, this.dryRun);
    console.log(`[bot:bsky] Fetched ${mentions.length} mention notifications`);

    for (const notif of mentions) {
      const record = notif.record as AppBskyFeedPost.Record;
      const author = notif.author;

      // Skip already-read notifications that are already in DB
      if (notif.isRead) {
        const isAnalyzed = await hasAnalyzedPost(this.env.DB, notif.uri);
        if (isAnalyzed) continue;
      }

      await this.processBskyPost(
        record,
        { uri: notif.uri, cid: notif.cid },
        { did: author.did, handle: author.handle, avatar: author.avatar },
        false,
      );
    }

    if (lastSeenAt) {
      await markNotificationsSeen(agent, lastSeenAt);
    }
  }

  private async pollBskySearch(): Promise<void> {
    const agent = this.bskyAgent!;
    const posts = await searchWordlePosts(agent);
    console.log(`[bot:bsky] Search returned ${posts.length} wordle posts`);

    for (const post of posts) {
      if (this.PROCESSED.has(post.uri)) continue;

      const record = post.record as AppBskyFeedPost.Record;
      const postText = record.text || '';
      const isFollowingBot = !!(post.author.viewer?.followedBy);
      const isGrowth = !postText.includes('@scoremywordle.bsky.social') && !isFollowingBot;

      await this.processBskyPost(
        record,
        { uri: post.uri, cid: post.cid },
        { did: post.author.did, handle: post.author.handle, avatar: post.author.avatar },
        isGrowth,
      );
    }
  }

  private async processBskyPost(
    record: AppBskyFeedPost.Record,
    ref: { uri: string; cid: string },
    author: { did: string; handle: string; avatar?: string },
    isGrowth: boolean,
  ): Promise<void> {
    const agent = this.bskyAgent!;
    const postHash = ref.uri.split('/').pop()!;
    const url = `https://bsky.app/profile/${author.handle}/post/${postHash}`;
    const textContent = record.text || '';
    const altTexts = getAltTextsFromEmbed(record.embed);

    const parentPost = record.reply?.parent;

    const input: ProcessPostInput = {
      text: textContent,
      altTexts,
      postId: ref.uri,
      authorId: author.did,
      screenName: '@' + author.handle,
      url,
      createdAt: record.createdAt,
      source: WordleSource.Bluesky,
      isGrowth,
      photo: author.avatar || '',
      parentPostFetcher: (parentPost && !isGrowth) ? async () => {
        const parent = await getParentPost(agent, parentPost.uri);
        if (parent) {
          const parentHash = parent.uri.split('/').pop()!;
          return {
            text: parent.record.text || '',
            altTexts: getAltTextsFromEmbed(parent.record.embed),
            postId: parent.uri,
            authorId: parent.author.did,
            screenName: '@' + parent.author.handle,
            url: `https://bsky.app/profile/${parent.author.handle}/post/${parentHash}`,
            createdAt: parent.record.createdAt,
            source: WordleSource.Bluesky,
            isGrowth: false,
            photo: parent.author.avatar || '',
          };
        }
        return null;
      } : undefined,
    };

    const result = await processWordlePost(this.env.DB, input, this.PROCESSING, this.PROCESSED);

    if (result?.shouldReply) {
      // Growth replies are disabled — match original bot behavior (line 377 of BlueskyWordleBot.ts)
      if (isGrowth) {
        console.log(`[bot:bsky] Skipping growth reply to ${url} (growth replies disabled)`);
        return;
      }

      if (this.dryRun) {
        console.log(`[bot:bsky] [DRY RUN] Would reply to ${url}: ${result.replyText}`);
      } else {
        try {
          const replyRef = buildReplyRef(ref.uri, ref.cid, record);
          await postReply(agent, result.replyText, replyRef);
          console.log(`[bot:bsky] Reply to ${url}: ${result.replyText}`);
        } catch (e) {
          console.error('[bot:bsky] Failed to reply:', e);
        }
      }
    }
  }
}

export const BotManager = Sentry.instrumentDurableObjectWithSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 0,
  }),
  BotManagerBase as any,
);

// ── Worker entry point ──

function checkAuth(request: Request, env: Env): Response | null {
  if (!env.BOT_SECRET) return null; // No secret configured = no auth required
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token !== env.BOT_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 0,
  }),
  {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route /bot/* to the BotManager DO
    if (url.pathname.startsWith('/bot/')) {
      // /bot/status is public; all other bot endpoints require auth
      if (url.pathname !== '/bot/status') {
        const authErr = checkAuth(request, env);
        if (authErr) return authErr;
      }

      const id = env.BOT_MANAGER.idFromName('singleton');
      const stub = env.BOT_MANAGER.get(id);
      const doPath = url.pathname.replace('/bot', '');
      return stub.fetch(new Request(`https://bot${doPath}`, {
        method: request.method,
        headers: request.headers,
      }));
    }

    return Response.json({ service: 'wordlescorer-worker', status: 'ok' });
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // Cron trigger: daily post at midnight UTC
    const id = env.BOT_MANAGER.idFromName('singleton');
    const stub = env.BOT_MANAGER.get(id);
    const res = await stub.fetch(new Request('https://bot/daily'));
    const body = await res.json();
    console.log('[cron] Daily post result:', JSON.stringify(body));
  },
} satisfies ExportedHandler<Env>);
