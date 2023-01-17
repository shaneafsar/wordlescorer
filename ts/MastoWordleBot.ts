import type { Attachment, MastoClient, Notification, Status } from 'masto';
import isValidWordle from '../utils/calculate/is-valid-wordle.js';
import { getSolvedRow } from '../utils/calculate/get-solved-row.js';
import { getWordleNumberFromList } from '../utils/extract/get-wordle-number-from-text.js';
import { calculateScoreFromWordleMatrix } from '../utils/calculate/calculate-score-from-wordle-matrix.js';
import type WordleData from '../WordleData.js';
import checkIsSameDay from '../utils/is-same-day.js';
import getWordleMatrixFromList from '../utils/extract/get-wordle-matrix-from-list.js';
import getScorerGlobalStats from '../utils/db/get-scorer-global-stats.js';
import { getSentenceSuffix } from '../utils/display/get-sentence-suffix.js';
import logError from '../utils/debug/log-error.js';
import type { SearchIndex } from 'algoliasearch';
import { JSDOM } from 'jsdom';


const SINCE_ID = 'since_id';

interface ProccessOptions {
  isGrowth: boolean;
  isParent: boolean;
};

enum WordleSource {
  Twitter = 'twitter',
  Mastodon = 'mastodon'
}

interface GlobalScore {
  wordleNumber?: number;
  wordleScore?: number;
  solvedRow?: number;
  postId?: string;
  userId?: string;
  screenName?: string;
  source: WordleSource
}

interface AlgoliaIndexObject {
  name?: string;
  score: number;
  solvedRow: number;
  wordleNumber: number;
  date_timestamp: number;
  id: string;
  autoScore: boolean;
  scorerName: string;
  photoUrl: string;
  source: WordleSource
}

interface WordleInfo {
  wordleScore: number;
  wordleNumber: number;
  solvedRow: number;
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

//FINAL TODOs: add env variables to prevent write, compile, npm start

const IS_DEVELOPMENT = process.env['NODE_ENV'] === 'develop';

function getAltTextList(medias: Attachment[]): string[] {
  return medias.map(media => {
      return media.description || '';
  })
}

export default class MastoWordleBot {
  private masto: MastoClient;
  private AlgoliaIndex: SearchIndex;
  private globalScores: WordleData;
  private userGrowth: WordleData;
  private analyzedPosts: WordleData;
  private users: WordleData;
  private lastMention: WordleData;
  private topScores: WordleData;

  private PROCESSING: Set<String> = new Set<String>();

  constructor(masto: MastoClient,
    algoliaIndex: SearchIndex, 
    globalScores: WordleData, 
    topScores: WordleData,
    userGrowth: WordleData,
    analyzedPosts: WordleData,
    users: WordleData,
    lastMention: WordleData) {
    this.masto = masto;
    this.AlgoliaIndex = algoliaIndex;
    this.globalScores = globalScores;
    this.topScores = topScores;
    this.userGrowth = userGrowth;
    this.analyzedPosts = analyzedPosts;
    this.users = users;
    this.lastMention = lastMention;
  }

  async initialize() {
    const [userTimeline, tagTimeline] = await Promise.all([
      this.masto.stream.streamUser(), 
      this.masto.stream.streamTagTimeline('Wordle')
    ]);

    // Add handlers
    tagTimeline.on('update', this.handleUpdate);
    userTimeline.on('notification', this.handleNotification);

  }

  /**
   * Used to fetch most recent mentions and process eligible posts.
   * Useful for cold starts or catching up after (un)expected downtime.
   */
  private async processRecentMentions() {
    const lastNotifId = this.lastMention.readSync(SINCE_ID) as string || null;
    const notifs = await this.masto.notifications.fetchMany({ limit: 100, sinceId: lastNotifId });
    while(!notifs.done) {
      for(const notif of notifs.value) {
        // If newer, then save as last mention id.
        if(lastNotifId !== null && notif.id.localeCompare(lastNotifId) > 0){
          this.lastMention.write(SINCE_ID, notif.id);
        }
        if(notif.type === 'mention' && notif.status !== null && notif.status !== undefined) {
          this.processPost(notif.status, {isGrowth: false, isParent: false});
        }
      }
    }
  }

  /**
   * Saves valid wordle results into daily global 
   * Per sever rules, no random "growth" related replies will be made here like
   * in the twitter version of the bot
   * @param status received status from stream
   */
  private async handleUpdate(status: Status) {

    const textContent = this.getWordleText(status.content) || '';
    const altTexts = getAltTextList(status.mediaAttachments);
    const listOfContent = [textContent, ...altTexts];
    const wordleMatrix = getWordleMatrixFromList(listOfContent);
    const userId = status.account.acct; //status.account.id;
    const screenName = '@' + status.account.acct;
    const postId = status.id;
    const wordleNumber = getWordleNumberFromList(listOfContent);
    const solvedRow = getSolvedRow(wordleMatrix);

    if (isValidWordle(wordleMatrix, wordleNumber, solvedRow)) {

      const wordleScore = calculateScoreFromWordleMatrix(wordleMatrix).finalScore;

      const scoreObj:GlobalScore = {
        wordleNumber,
        wordleScore,
        solvedRow,
        postId,
        userId,
        screenName,
        source: WordleSource.Mastodon
      };

      this.globalScores.write(userId, scoreObj);
    }
  }

  private async handleNotification(notification: Notification) {
    if(notification.type === 'follow') {
      //await this.masto.accounts.follow(notification.account.id);
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
    return `${name} This ${wordlePrefix} scored ${score} out of 360${getSentenceSuffix(solvedRow)} ${aboveTotal} ${getCompliment(isGrowth)}`;
  }

  private addToIndex(objectToIndex: AlgoliaIndexObject) {
    if(!IS_DEVELOPMENT) {
        this.AlgoliaIndex.saveObjects([objectToIndex], { autoGenerateObjectIDIfNotExist: true })
        .catch((e) => {
            logError('Algolia saveObjects error | ', e);
        });
    }
  }

  private async addToIndices(
    { wordleScore, wordleNumber, solvedRow } : WordleInfo,
    { userId, screenName, photo } : AuthorInfo,
    { url }: PostInfo,
    { isGrowth }: ProccessOptions) {

    const analyzedPost = {
        score: wordleScore,
        solvedRow,
        wordleNumber,
        date_timestamp: Math.floor(Date.now() / 1000),
        id: url,
        autoScore: isGrowth,
        scorerName: screenName,
        source: WordleSource.Mastodon
    };

    await this.analyzedPosts.write(url, analyzedPost);

    if(photo && userId) {
        this.users.write(userId, {
            user_id: userId,
            screen_name: screenName,
            photo: photo
        });
    }
  
    this.addToIndex({
        ...analyzedPost,
        photoUrl: photo || 'https://cdn.mastodon.online/avatars/original/missing.png'
    });
  }

  private async writeScoresToDB(
    { wordleScore, wordleNumber, solvedRow} : WordleInfo,
    { userId, screenName } : AuthorInfo,
    { postId, url, createdAt }: PostInfo,
    { isGrowth }: ProccessOptions) {

    const createdAtDate = new Date(createdAt);
    const createdAtMs = createdAtDate.getTime();
    const isSameDay = checkIsSameDay(createdAtDate);  

     const scoreObj:GlobalScore = {
       wordleNumber,
       wordleScore,
       solvedRow,
       postId,
       userId,
       screenName,
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
           score: wordleScore,
           solvedRow,
           datetime: createdAtMs,
           autoScore: isGrowth,
           wordleNumber,
           url
       });
     }
  }

  private async replyWordleScore(
    { wordleScore, wordleNumber, solvedRow} : WordleInfo,
    { screenName } : AuthorInfo,
    { postId }: PostInfo,
    { isGrowth }: ProccessOptions) {
    try {
      const { wordlePrefix, aboveTotal } = await getScorerGlobalStats({solvedRow, wordleNumber, date: new Date()});
      const status = this.buildStatus(screenName, wordlePrefix, wordleScore, solvedRow, aboveTotal, isGrowth);

      await this.masto.statuses.create({ 
        status,
        inReplyToId: postId 
      });


    } catch(e) {
        logError('failed to get globalScorerGlobalStats & reply | ', e);
    } finally {
        this.PROCESSING.delete(postId);
    }
  }

  private async processPost(status: Status, options: ProccessOptions) {
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
    const solvedRow = getSolvedRow(wordleMatrix);
    
    this.userGrowth.write(userId, { lastCheckTime: Date.now()});

    /**
     * Bail early if this tweet has been processed or is 
     * processing.
     */  
    if(this.analyzedPosts.readSync(postId) || this.PROCESSING.has(postId)) {
      return;
    }

    this.PROCESSING.add(postId);

    if (isValidWordle(wordleMatrix, wordleNumber, solvedRow)) {

      const wordleInfo: WordleInfo = {
        wordleScore: calculateScoreFromWordleMatrix(wordleMatrix).finalScore,
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
      !this.analyzedPosts.hasKey(parentId) &&
      !this.PROCESSING.has(parentId)) {
        
      try {
        const context = await this.masto.statuses.fetchContext(status.id);
        if(context.ancestors.length > 0) {
          this.processPost(context.ancestors.pop()!, { isGrowth: false, isParent: true});
        } else {
          logError('unable to retreive parent status | ', context);
        }
      } catch (e) {
        logError('error finding parent post, request failed | ', e);
      } finally {
        this.PROCESSING.delete(postId);
      }

    }
  }
}