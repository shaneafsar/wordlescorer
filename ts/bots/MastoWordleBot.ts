import type { mastodon } from 'masto';
import isValidWordle from '../calculate/is-valid-wordle.js';
import { getSolvedRow } from '../calculate/get-solved-row.js';
import { getWordleNumberFromList } from '../extract/get-wordle-number-from-text.js';
import { calculateScoreFromWordleMatrix } from '../calculate/calculate-score-from-wordle-matrix.js';
import type WordleData from '../db/WordleData.js';
import checkIsSameDay from '../util/is-same-day.js';
import getWordleMatrixFromList from '../extract/get-wordle-matrix-from-list.js';
import getScorerGlobalStats from '../db/get-scorer-global-stats.js';
import { getSentenceSuffix } from '../display/get-sentence-suffix.js';
import logError from '../debug/log-error.js';
import WordleSource from '../enum/WordleSource.js';
import { JSDOM } from 'jsdom';
import logConsole from '../debug/log-console.js';
import { getCompliment } from '../display/getCompliment.js';
import { isWordleHardModeFromList } from '../extract/isWordleHardMode.js';
import { retry } from '../util/retry.js';
import { hasReplied, markReplied } from '../db/reply-cache.js';

//FINAL TODOs: add env variables to prevent write, compile, npm start

const IS_DEVELOPMENT = process.env['NODE_ENV'] === 'develop';
const BOT_ID = '113431538735189987';
const ALLOW_LIST = new Set<String>(['@shaneafsar@mastodon.online']);
const SINCE_ID = 'since_id';

interface ProccessOptions {
  isGrowth: boolean;
  isParent: boolean;
};

interface GlobalScore {
  wordleNumber?: number;
  wordleScore?: number;
  solvedRow?: number;
  url?: string;
  userId?: string;
  screenName?: string;
  isHardMode?: boolean;
  source: WordleSource;
}

interface WordleInfo {
  wordleScore: number;
  wordleNumber: number;
  solvedRow: number;
  isHardMode?: boolean;
}

interface PostInfo {
  postId: string;
  url: string;
  createdAt: string;
}

interface AuthorInfo {
  userId: string;
  screenName: string;
  photo: string;
}

function getAltTextList(medias: mastodon.v1.MediaAttachment[]): string[] {
  return medias.map(media => {
      return media.description || '';
  })
}

export default class MastoWordleBot {
  private masto: mastodon.rest.Client;
  private streaming: mastodon.streaming.Client;
  private globalScores: WordleData;
  private userGrowth: WordleData;
  private analyzedPosts: WordleData;
  private users: WordleData;
  private lastMention: WordleData;
  private topScores: WordleData;
  private destroyed: boolean = false;

  private PROCESSING: Set<String> = new Set<String>();

  constructor(masto: mastodon.rest.Client,
    streaming: mastodon.streaming.Client,
    globalScores: WordleData,
    topScores: WordleData,
    userGrowth: WordleData,
    analyzedPosts: WordleData,
    users: WordleData,
    lastMention: WordleData) {
    this.masto = masto;
    this.streaming = streaming;
    this.globalScores = globalScores;
    this.topScores = topScores;
    this.userGrowth = userGrowth;
    this.analyzedPosts = analyzedPosts;
    this.users = users;
    this.lastMention = lastMention;
  }

  async initialize() {
    await this.processRecentMentions();

    // TEMP: add followers to allowlist
    const followers = await this.masto.v1.accounts.$select(BOT_ID).followers.list();
    for (const follower of followers) {
      ALLOW_LIST.add(`@${follower.acct}`);
    }

    // Start streaming in background (non-blocking)
    this.streamUserTimeline();

    await new Promise(res => setTimeout(res, 500));

    this.streamTagTimeline();
  }

  destroy() {
    this.destroyed = true;
  }

  private async streamUserTimeline() {
    try {
      const subscription = this.streaming.user.subscribe();
      for await (const event of subscription) {
        if (this.destroyed) break;
        if (event.event === 'notification') {
          this.handleNotification(event.payload as mastodon.v1.Notification);
        }
      }
    } catch (e) {
      if (!this.destroyed) {
        logError('[bot:masto] User timeline stream error:', e);
      }
    }
  }

  private async streamTagTimeline() {
    try {
      const subscription = this.streaming.hashtag.subscribe({ tag: 'Wordle' });
      for await (const event of subscription) {
        if (this.destroyed) break;
        if (event.event === 'update') {
          this.handleUpdate(event.payload as mastodon.v1.Status);
        }
      }
    } catch (e) {
      if (!this.destroyed) {
        logError('[bot:masto] Tag timeline stream error:', e);
      }
    }
  }

  /**
   * Used to fetch most recent mentions and process eligible posts.
   * Useful for cold starts or catching up after (un)expected downtime.
   */
  private async processRecentMentions() {
    let lastNotifId = await this.lastMention.read(SINCE_ID, null, true) as string || null;
    //console.log('mastobot notif | ', lastNotifId);
    const notifs = await this.masto.v1.notifications.list({ limit: 100, sinceId: lastNotifId });

    for(const notif of notifs) {
      // If newer, then save as last mention id. iF non existent, then add it.
      if(lastNotifId !== null && notif.id.localeCompare(lastNotifId) > 0){
        this.lastMention.write(SINCE_ID, notif.id);
      } else if (!lastNotifId) {
        lastNotifId = notif.id;
        this.lastMention.write(SINCE_ID, notif.id);
      }
      if(notif.type === 'mention' && notif.status !== null && notif.status !== undefined) {
        this.processPost(notif.status, {isGrowth: false, isParent: false});
      }
    }
  }

  /**
   * Saves valid wordle results into daily global 
   * Per sever rules, no random "growth" related replies will be made here like
   * in the twitter version of the bot. This will only reply if the bot is followed explicitly
   * by the hashtagged update.
   * @param status received status from stream
   */
  private async handleUpdate(status: mastodon.v1.Status) {

    const relationships = await this.masto.v1.accounts.relationships.fetch({ id: [status.account.id] });
    // There should only ever be 1 here, but api returns as array
    let isFollowingBot = relationships[0]?.followedBy || false;
    logConsole('[bot:masto] isFollowing? ', isFollowingBot , ' | ', status.account.acct);
    if(isFollowingBot) {

      this.processPost(status, {isGrowth: false, isParent: false});

    } else {

      const textContent = this.getWordleText(status.content) || '';
      const altTexts = getAltTextList(status.mediaAttachments);
      const listOfContent = [textContent, ...altTexts];
      const wordleMatrix = getWordleMatrixFromList(listOfContent);
      // Add domain for local users
      const userId = status.account.acct.indexOf('@') > -1 ? status.account.acct : status.account.acct+'@mastodon.social'; 
      const screenName = '@' + status.account.acct;
      const url = status.url || '';
      const wordleNumber = getWordleNumberFromList(listOfContent);
      const isHardMode = isWordleHardModeFromList(listOfContent);
      const solvedRow = getSolvedRow(wordleMatrix);

    

      if (isValidWordle(wordleMatrix, wordleNumber, solvedRow)) {

        const wordleScore = calculateScoreFromWordleMatrix(wordleMatrix).finalScore;

        const scoreObj:GlobalScore = {
          wordleNumber,
          wordleScore,
          solvedRow,
          url,
          userId,
          screenName,
          isHardMode,
          source: WordleSource.Mastodon
        };

        this.globalScores.write(userId, scoreObj);
      }
    }
  }

  private async handleNotification(notification: mastodon.v1.Notification) {
    if(notification.type === 'follow') {
      ALLOW_LIST.add(`@${notification.account.acct}`);
      this.masto.v1.accounts.$select(notification.account.id).follow({
        reblogs: false
      });
    }

    if (notification.type === 'mention' && notification.status) {
      this.lastMention.write(SINCE_ID, notification.id);

      this.processPost(notification.status, { isGrowth: false, isParent: false});
    }
  }

  private getWordleText(content: string) {
    const dom = new JSDOM(content);
    return dom.window.document.body.textContent;
  }

  private buildStatus(name: string, wordlePrefix: string, score: number, solvedRow: number, aboveTotal: string, isGrowth: boolean) {
    return `${name} This ${wordlePrefix} scored ${score} out of 420${getSentenceSuffix(solvedRow)} ${aboveTotal} ${getCompliment(isGrowth)}`;
  }

  private async addToIndices(
    { wordleScore, wordleNumber, solvedRow, isHardMode } : WordleInfo,
    { userId, screenName, photo } : AuthorInfo,
    { url, postId }: PostInfo,
    { isGrowth }: ProccessOptions) {

    const analyzedPost = {
        score: wordleScore,
        solvedRow,
        wordleNumber,
        date_timestamp: Math.floor(Date.now() / 1000),
        url,
        autoScore: isGrowth,
        isHardMode: isHardMode || false,
        scorerName: screenName,
        source: WordleSource.Mastodon
    };

    await this.analyzedPosts.write(postId, analyzedPost);

    if(photo && userId) {
        this.users.write(userId, {
            user_id: userId,
            screen_name: screenName,
            photo: photo
        });
    }
  }

  private async writeScoresToDB(
    { wordleScore, wordleNumber, solvedRow, isHardMode} : WordleInfo,
    { userId, screenName } : AuthorInfo,
    { url, createdAt }: PostInfo,
    { isGrowth }: ProccessOptions) {

    const createdAtDate = new Date(createdAt);
    const createdAtMs = createdAtDate.getTime();
    const isSameDay = checkIsSameDay(createdAtDate);  

     const scoreObj:GlobalScore = {
       screenName,
       wordleNumber,
       wordleScore,
       solvedRow,
       url,
       userId,
       isHardMode,
       source: WordleSource.Mastodon
     };

     this.globalScores.write(userId, scoreObj);

     /**
      * Add to today's scores if tweet happened today
      * Only allow one score per user
      */
     if(isSameDay) {
       this.topScores.write(userId, {
           screenName,
           wordleNumber,
           score: wordleScore,
           solvedRow,
           datetime: createdAtMs,
           autoScore: isGrowth,
           isHardMode: isHardMode || false,
           url,
           source: WordleSource.Mastodon
       });
     }
  }

  private async replyWordleScore(
    { wordleScore, wordleNumber, solvedRow} : WordleInfo,
    { screenName } : AuthorInfo,
    { postId }: PostInfo,
    { isGrowth }: ProccessOptions) {
    try {
      const { wordlePrefix, aboveTotal } = await getScorerGlobalStats({solvedRow, wordleNumber, date: new Date()}, this.globalScores);
      const status = this.buildStatus(screenName, wordlePrefix, wordleScore, solvedRow, aboveTotal, isGrowth);

      if (hasReplied(postId)) {
        logConsole(`[bot:masto] skipping duplicate reply to ${postId}`);
        return;
      }

      const shouldPostRealStatus = !IS_DEVELOPMENT || (IS_DEVELOPMENT && ALLOW_LIST.has(screenName));

      if(shouldPostRealStatus) {
        await this.masto.v1.statuses.create({
          status,
          inReplyToId: postId
        });
        markReplied(postId);
        logConsole(`[bot:masto] reply to ${postId}: ${status}`);
      } else if (IS_DEVELOPMENT) {
        logConsole(`[bot:masto] [DRY RUN] ${screenName} | Wordle #${wordleNumber} | Score: ${wordleScore} | Row: ${solvedRow} | Reply: "${status}"`);
      }

    } catch(e) {
        logError('[bot:masto] failed to get globalScorerGlobalStats & reply | ', e);
    } finally {
        this.PROCESSING.delete(postId);
    }
  }

  private async processPost(status: mastodon.v1.Status, options: ProccessOptions) {
    const { isGrowth, isParent } = options;
    const url = status.url || '';
    const textContent = this.getWordleText(status.content) || '';
    const altTexts = getAltTextList(status.mediaAttachments);
    const listOfContent = [textContent, ...altTexts];
    const wordleMatrix = getWordleMatrixFromList(listOfContent);
    const parentId = status.inReplyToId || '';
    const userId = status.account.acct; //status.account.id;
    const screenName = '@' + status.account.acct;
    const postId = status.id;
    const photo = status.account.avatar;
    const wordleNumber = getWordleNumberFromList(listOfContent);
    const isHardMode = isWordleHardModeFromList(listOfContent);
    const solvedRow = getSolvedRow(wordleMatrix);
    
    this.userGrowth.write(userId, { lastCheckTime: Date.now()});

    /**
     * Bail early if this post has been processed or is 
     * processing.
     */  
    if(this.PROCESSING.has(postId)) {
      return;
    }

    const post = await this.analyzedPosts.hasKeyAsync(postId);
    if(post) {
      logConsole(`[bot:masto] post ${postId} already processed`);
      return;
    }

    this.PROCESSING.add(postId);

    const isValid = isValidWordle(wordleMatrix, wordleNumber, solvedRow);
    logConsole(`[bot:masto] processing ${postId} | ${screenName} | isValidWordle? `, isValid, ' | wordle number: ', wordleNumber, '| solvedRow: ', solvedRow, ' | isHardMode: ', isHardMode);

    if (isValid) {

      const wordleInfo: WordleInfo = {
        wordleScore: calculateScoreFromWordleMatrix(wordleMatrix, isHardMode).finalScore,
        wordleNumber,
        solvedRow
      };

      const postInfo: PostInfo = {
        postId,
        url,
        createdAt: status.createdAt
      }

      const authorInfo: AuthorInfo = {
        screenName,
        userId,
        photo
      };

      this.writeScoresToDB(wordleInfo, authorInfo, postInfo, options);

      this.addToIndices(wordleInfo, authorInfo, postInfo, options);

      this.replyWordleScore(wordleInfo, authorInfo, postInfo, options);

    } else if(
      parentId && 
      !isGrowth &&
      !isParent && 
      !this.PROCESSING.has(parentId)) {

      const hasId = await this.analyzedPosts.hasKeyAsync(parentId);
      if(!hasId) {
        try {
            const context = await this.masto.v1.statuses.$select(status.id).context.fetch();
            if(context.ancestors.length > 0) {
              this.processPost(context.ancestors.pop()!, { isGrowth: false, isParent: true});
            } else {
              logError('[bot:masto] unable to retrieve parent status | ', context);
            }
          } catch (e) {
            logError('[bot:masto] error finding parent post, request failed | ', e);
          } finally {
            this.PROCESSING.delete(postId);
          }
      }
    }
  }
}