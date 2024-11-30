import atproto, { BskyAgent, AppBskyNotificationListNotifications, AppBskyFeedPost, AppBskyEmbedImages } from '@atproto/api';
import isValidWordle from '../../js/calculate/is-valid-wordle.js';
import { getSolvedRow } from '../../js/calculate/get-solved-row.js';
import { getWordleNumberFromList } from '../../js/extract/get-wordle-number-from-text.js';
import { calculateScoreFromWordleMatrix } from '../../js/calculate/calculate-score-from-wordle-matrix.js';
import type WordleData from '../../js/WordleData.js';
import checkIsSameDay from '../../js/is-same-day.js';
import getWordleMatrixFromList from '../../js/extract/get-wordle-matrix-from-list.js';
import getScorerGlobalStats from '../../js/db/get-scorer-global-stats.js';
import { getSentenceSuffix } from '../../js/display/get-sentence-suffix.js';
import logError from '../../js/debug/log-error.js';
import type { SearchIndex } from 'algoliasearch';
import WordleSource from '../enum/WordleSource.js';
import logConsole from '../../js/debug/log-console.js';
import { getCompliment } from '../display/getCompliment.js';
import { isWordleHardModeFromList } from '../../ts/extract/isWordleHardMode.js';

//FINAL TODOs: add env variables to prevent write, compile, npm start

const IS_DEVELOPMENT = process.env['NODE_ENV'] === 'develop';

const POLLING_INTERVAL = 25000;

interface BskyAuthor { 
  avatar?: string;
  did: string;
  handle: string;
}

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
  source: WordleSource
}

interface AlgoliaIndexObject {
  name?: string;
  score: number;
  solvedRow: number;
  wordleNumber: number;
  date_timestamp: number;
  url: string;
  autoScore: boolean;
  isHardMode: boolean;
  scorerName: string;
  photoUrl: string;
  source: WordleSource
}

interface WordleInfo {
  wordleScore: number;
  wordleNumber: number;
  solvedRow: number;
  isHardMode?: boolean;
}

interface PostInfo {
  postId: string;
  postCid: string;
  url: string;
  createdAt: string;
  replyRef: AppBskyFeedPost.ReplyRef;
}

interface AuthorInfo {
  userId: string;
  screenName: string;
  photo: string;
}

type SearchResult = {
  tid: string
  cid: string
  user: {
    did: string
    handle: string
  }
  post: {
    createdAt: number
    text: string
    user: string // really should be "handle"
  }
}

/**
 * Pulled from https://github.com/hs4man21/bluesky-alt-text-ocr/blob/30e94008fe7195887a775265b117c9f781f8695a/index.ts#L174
 * Extracts the root cid and uri from a record, or returns the original cid and uri if not a reply
 */
function getRootCdiAndUri(record: AppBskyFeedPost.Record, postUri: string, postCid: string) {
  return {
    cid:
      (
        record as {
          reply?: { root?: { cid?: string; uri?: string } };
        }
      )?.reply?.root?.cid || postCid,
    uri:
      (
        record as {
          reply?: { root?: { cid?: string; uri?: string } };
        }
      )?.reply?.root?.uri || postUri,
  };
}


export default class BlueskyWordleBot {
  private agent: BskyAgent;
  private AlgoliaIndex: SearchIndex;
  private globalScores: WordleData;
  private userGrowth: WordleData;
  private analyzedPosts: WordleData;
  private users: WordleData;
  private topScores: WordleData;
  private timeoutId: NodeJS.Timeout | null;
  private lastGrowthReplyTime: number | null = null;

  private PROCESSING: Set<String> = new Set<String>();

  constructor(agent: BskyAgent,
    algoliaIndex: SearchIndex, 
    globalScores: WordleData, 
    topScores: WordleData,
    userGrowth: WordleData,
    analyzedPosts: WordleData,
    users: WordleData) {
    this.agent = agent;
    this.AlgoliaIndex = algoliaIndex;
    this.globalScores = globalScores;
    this.topScores = topScores;
    this.userGrowth = userGrowth;
    this.analyzedPosts = analyzedPosts;
    this.users = users;
    this.timeoutId = null;
  }

  async initialize() {
    this.pollApi();
  }

  destroy() {
    if(this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  /**
   * Poll notiifcations for @ mentions, mark them as seen, and process them.
   */
  private async pollApi(): Promise<void> {
    try {
      // Request data from the API endpoint
      const notifs: AppBskyNotificationListNotifications.Notification[] = await this.getNotifications();

      for await (const notif of notifs) {


        this.processPost(
          notif.record as AppBskyFeedPost.Record, 
          { uri: notif.uri, cid: notif.cid}, 
          { did: notif.author.did, handle: notif.author.handle, avatar: notif.author.avatar },
          { isGrowth: false, isParent: false}
        );


      }

      if (notifs.length > 0) {
        const seenAt = notifs[notifs.length - 1]?.indexedAt;
        await this.agent.updateSeenNotifications(seenAt);
      }

      // Manually extracting from HTTP API for now.
      const searchResponse = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=wordle&limit=100&sort=latest');
      if (searchResponse.ok) {
        const searchResults: { posts: Array<any> } = await searchResponse.json();

        // Iterate through each post in the search results
        for (const post of searchResults.posts) {
          this.processPost(
            post.record as AppBskyFeedPost.Record,
            { uri: post.uri, cid: post.cid },
            { did: post.author.did, handle: post.author.handle, avatar: post.author.avatar },
            { isGrowth: true, isParent: false }
          );
        }
      } else {
        console.error('Failed to fetch search results:', searchResponse.status, searchResponse.statusText);
      }


    } catch (err) {
      logError(err);
    }
    this.timeoutId = setTimeout(this.pollApi.bind(this), POLLING_INTERVAL);
  }

  private async getNotifications(): Promise<AppBskyNotificationListNotifications.Notification[]> {
    if (!this.agent) {
      throw new Error('getNotifications: bluesky agent not set up');
    }
    const notifs = await this.agent.listNotifications({ limit: 100 });
    if (!notifs.success) {
      throw new Error('getNotifications: failed to get bluesky notifications');
    }
    const out: AppBskyNotificationListNotifications.Notification[] = [];
    for (const notif of notifs.data.notifications) {
      if (notif.reason !== 'mention') {
        if(notif.reason === 'follow') {
          // Warning! We need to check if we're already following this user, otherwise we'll annoy them with notifs until
          // this notification falls off the first page of our bot account.
          if(!notif.author.viewer?.followedBy){
            this.agent.follow(notif.author.did);
          }
        }    
        continue;
      }
      if ((notif.record as { text: string })?.text.startsWith(process.env['BSKY_USERNAME'] as string)) {
        continue;
      }
      if (notif.isRead) {
        // Helps capture orphaned mentions that haven't been processed yet
        const postIsAnalyzed = await this.analyzedPosts.hasKeyAsync(notif.uri);
        if (postIsAnalyzed) {
          continue;
        }
      }
      out.push(notif);
    }
    return out;
  }


  private buildStatus(name: string, wordlePrefix: string, score: number, solvedRow: number, aboveTotal: string, isGrowth: boolean) {
    return `${name} This ${wordlePrefix} scored ${score} out of 420${getSentenceSuffix(solvedRow)} ${aboveTotal} ${getCompliment(isGrowth)}`;
  }

  private addToIndex(objectToIndex: AlgoliaIndexObject) {
    if(!IS_DEVELOPMENT) {
        this.AlgoliaIndex.saveObjects([objectToIndex], { autoGenerateObjectIDIfNotExist: true })
        .catch((e) => {
            logError('BskyBot | Algolia saveObjects error | ', e);
        });
    } else {
      logConsole('BskyBot | DEVMODE | addToIndex | ', objectToIndex.url);
    }
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
        scorerName: screenName,
        isHardMode: isHardMode || false,
        source: WordleSource.Bluesky
    };

    await this.analyzedPosts.write(postId, analyzedPost);

    if(photo && userId) {
        this.users.write(userId, {
            user_id: userId,
            screen_name: screenName,
            photo: photo
        });
    }
  
    this.addToIndex({
        ...analyzedPost,
        photoUrl: photo || 'https://i.imgur.com/MvfJVWa.png'
    });
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
       source: WordleSource.Bluesky
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
           source: WordleSource.Bluesky
       });
     }
  }

  private async replyWordleScore(
    { wordleScore, wordleNumber, solvedRow} : WordleInfo,
    { screenName, userId } : AuthorInfo,
    { postId, replyRef, url }: PostInfo,
    { isGrowth }: ProccessOptions) {
    try {
      const { wordlePrefix, aboveTotal } = await getScorerGlobalStats({solvedRow, wordleNumber, date: new Date()}, this.globalScores);
      const status = this.buildStatus(screenName, wordlePrefix, wordleScore, solvedRow, aboveTotal, isGrowth);

      // Set/cache last reply time
      if(!this.lastGrowthReplyTime && await this.userGrowth.hasKeyAsync('lastCheckTime')) {
        const checkResultTime = await this.userGrowth.read('lastCheckTime');
        this.lastGrowthReplyTime = checkResultTime?.lastCheckTime ?? null;
      }      
      
      // Check if new replies are allowed based on the last reply time
      const now = Date.now();
      if (isGrowth && this.lastGrowthReplyTime) {
        const timeAgo = now - 3600 * 1000;
        if (this.lastGrowthReplyTime > timeAgo) {
          logConsole(`BskyBot | Skipping reply for ${screenName} | ${url} | Last reply was too recent.`);
          this.PROCESSING.delete(postId);
          return;
        }
      }

      // We should only reply at most once to new users who havent @-mentioned us before
      const isGrowthAlreadyChecked = isGrowth && await this.userGrowth.hasKeyAsync(userId);
      const shouldPostRealStatus = !IS_DEVELOPMENT && !isGrowthAlreadyChecked;
      
      if(shouldPostRealStatus) {
        const rt = new atproto.RichText({ text: status });
        await rt.detectFacets(this.agent);
        await this.agent.post({ 
          text: rt.text, 
          facets: rt.facets,
          reply: replyRef
        });

        if (isGrowth) {
          this.lastGrowthReplyTime = now;
          const lastCheckTime = { lastCheckTime: now};
          await this.userGrowth.write('lastCheckTime', lastCheckTime);
        }
      }
      logConsole(`BskyBot | ${IS_DEVELOPMENT ? 'DEVMODE' : ''} reply to ${url}: ${status}`);

      this.userGrowth.write(userId, { lastCheckTime: Date.now()});

    } catch(e) {
        logError('BskyBot | failed to get globalScorerGlobalStats & reply | ', e);
    } finally {
        this.PROCESSING.delete(postId);
    }
  }

  private async processPost(status: AppBskyFeedPost.Record, {uri, cid} : {uri:string, cid:string}, author: BskyAuthor, options: ProccessOptions) {
    const { isGrowth, isParent } = options;
    const postHash = uri.split('/').pop() as string;
    const url = `https://bsky.app/profile/${author.handle}/post/${postHash}`;

    const textContent = status.text || '';
    const altTexts = status.embed && (status.embed as any).images?.map((image:AppBskyEmbedImages.Image) => { 
      return image.alt;
    }) || [];
    const listOfContent = [textContent, ...altTexts];
    const wordleMatrix = getWordleMatrixFromList(listOfContent);
    const userId = author.did;
    const screenName = '@' + author.handle;
    const postId = uri;
    const postCid = cid;
    const photo = author.avatar || '';
    const wordleNumber = getWordleNumberFromList(listOfContent);
    const isHardMode = isWordleHardModeFromList(listOfContent);
    const solvedRow = getSolvedRow(wordleMatrix);

    const parentPost = status.reply?.parent;
  

    /**
     * Bail early if this post has been processed or is 
     * processing.
     */  
    if(this.PROCESSING.has(postId)) {
      return;
    }

    //const post = await this.analyzedPosts.read(postId, null, true);
    const post = await this.analyzedPosts.hasKeyAsync(postId);
    if(post) {
      //console.log(`BskyBot | post ${postId} already processed`);
      return;
    }

    this.PROCESSING.add(postId);

    const isValid = isValidWordle(wordleMatrix, wordleNumber, solvedRow);

    if (isValid) {

      logConsole(`${postId} | ${screenName} | isValidWordle? `, isValid, ' | wordle number: ', wordleNumber, '| solvedRow: ', solvedRow, ' | isHardMode: ', isHardMode);

      const wordleInfo: WordleInfo = {
        wordleScore: calculateScoreFromWordleMatrix(wordleMatrix, isHardMode).finalScore,
        wordleNumber,
        solvedRow,
        isHardMode
      };

      const postInfo: PostInfo = {
        postId,
        postCid,
        url,
        createdAt: status.createdAt,
        replyRef: {
          parent: { uri: postId, cid: postCid },
          root: getRootCdiAndUri(status, postId, postCid)
        }
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
      parentPost && 
      !isGrowth &&
      !isParent &&
      !this.PROCESSING.has(parentPost.uri)) {

      const hasId = await this.analyzedPosts.hasKeyAsync(parentPost.uri);
      
      if(!hasId) {
        try {
          
          const parentThread = await this.agent.getPostThread({ uri: parentPost.uri });
          const parentRecord = (parentThread?.data?.thread?.post as any)?.record;
          const parentAuthor = (parentThread?.data?.thread?.post as any)?.author;
  
          if(parentRecord && parentAuthor && parentAuthor.handle && parentAuthor.did) {
            this.processPost(
              parentRecord as AppBskyFeedPost.Record, 
              { uri: parentPost.uri, cid: parentPost.cid }, 
              { did: parentAuthor.did, handle: parentAuthor.handle, avatar: parentAuthor.avatar }, 
              { isGrowth: false, isParent: true});
          } else {
            logError('BskyBot | unable to retreive parent status | ', parentPost);
          }
        } catch (e) {
          logError('BskyBot | error finding parent post, request failed | ', e);
        } finally {
          this.PROCESSING.delete(postId);
        }
      }

    }
  }
}