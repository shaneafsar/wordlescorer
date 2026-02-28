import { AtpAgent, RichText, AppBskyFeedPost, AppBskyEmbedImages, AppBskyFeedDefs, AppBskyNotificationListNotifications } from '@atproto/api';
import { retry } from './util';

export type BskyNotification = AppBskyNotificationListNotifications.Notification;
export type BskyPostView = AppBskyFeedDefs.PostView;
export type BskyPostRecord = AppBskyFeedPost.Record;

export async function createBskyAgent(username: string, password: string): Promise<AtpAgent> {
  const agent = new AtpAgent({ service: 'https://bsky.social' });
  await agent.login({ identifier: username, password });
  return agent;
}

/** List unread mention notifications, auto-follow new followers */
export async function pollNotifications(
  agent: AtpAgent, dryRun: boolean = true
): Promise<{ mentions: BskyNotification[]; lastSeenAt: string | undefined }> {
  const out: BskyNotification[] = [];

  const notifs = await retry(
    () => agent.listNotifications({ limit: 100 }),
    3, 1000,
    () => true,
    { success: false, headers: {}, data: { notifications: [] } } as any
  );

  if (!notifs.success) {
    console.error('[bot:bsky] Failed to get notifications');
    return { mentions: out, lastSeenAt: undefined };
  }

  for (const notif of notifs.data.notifications) {
    if (notif.reason === 'follow') {
      // Auto-follow back if not already following
      if (!notif.author.viewer?.followedBy) {
        if (dryRun) {
          console.log(`[bot:bsky] [DRY RUN] Would follow back ${notif.author.handle}`);
        } else {
          try {
            await agent.follow(notif.author.did);
          } catch (e) {
            console.error('[bot:bsky] Failed to follow back:', e);
          }
        }
      }
      continue;
    }

    if (notif.reason !== 'mention') continue;

    // Skip if text starts with bot username
    if ((notif.record as { text: string })?.text.startsWith('@scoremywordle.bsky.social')) {
      continue;
    }

    out.push(notif);
  }

  const lastSeenAt = notifs.data.notifications.length > 0
    ? notifs.data.notifications[notifs.data.notifications.length - 1]?.indexedAt
    : undefined;

  return { mentions: out, lastSeenAt };
}

/** Mark notifications as seen */
export async function markNotificationsSeen(agent: AtpAgent, seenAt: string): Promise<void> {
  await agent.updateSeenNotifications(seenAt as `${string}-${string}-${string}T${string}:${string}:${string}Z`);
}

/** Search Bluesky for recent wordle posts */
export async function searchWordlePosts(agent: AtpAgent): Promise<BskyPostView[]> {
  const res = await agent.app.bsky.feed.searchPosts({
    q: 'wordle',
    limit: 100,
    sort: 'latest',
  });

  if (!res.success) {
    console.error('[bot:bsky] Failed to search posts');
    return [];
  }

  return res.data.posts;
}

/** Post a reply to a Bluesky post */
export async function postReply(
  agent: AtpAgent, text: string,
  replyRef: AppBskyFeedPost.ReplyRef
): Promise<void> {
  const rt = new RichText({ text });
  await rt.detectFacets(agent);
  await agent.post({
    text: rt.text,
    facets: rt.facets,
    reply: replyRef,
  });
}

/** Post a standalone status to Bluesky */
export async function postBskyStatus(agent: AtpAgent, text: string): Promise<void> {
  const rt = new RichText({ text });
  await rt.detectFacets(agent);
  await agent.post({ text: rt.text, facets: rt.facets });
}

/** Get the parent thread of a post */
export async function getParentPost(
  agent: AtpAgent, uri: string
): Promise<{ record: BskyPostRecord; uri: string; cid: string; author: { did: string; handle: string; avatar?: string } } | null> {
  try {
    const parentThread = await agent.getPostThread({ uri });
    const thread = parentThread?.data?.thread as any;
    const parentRecord = thread?.post?.record;
    const parentAuthor = thread?.post?.author;

    if (parentRecord && parentAuthor?.handle && parentAuthor?.did) {
      return {
        record: parentRecord,
        uri: thread.post.uri,
        cid: thread.post.cid,
        author: { did: parentAuthor.did, handle: parentAuthor.handle, avatar: parentAuthor.avatar },
      };
    }
  } catch (e) {
    console.error('[bot:bsky] Error fetching parent post:', e);
  }
  return null;
}

/** Extract alt texts from a Bluesky post embed */
export function getAltTextsFromEmbed(embed: any): string[] {
  if (!embed?.images) return [];
  return (embed.images as AppBskyEmbedImages.Image[]).map(img => img.alt || '');
}

/** Build reply ref from a post URI/CID and its record */
export function buildReplyRef(
  postUri: string, postCid: string, record: BskyPostRecord
): AppBskyFeedPost.ReplyRef {
  const root = {
    cid: (record as any)?.reply?.root?.cid || postCid,
    uri: (record as any)?.reply?.root?.uri || postUri,
  };
  return {
    parent: { uri: postUri, cid: postCid },
    root,
  };
}
