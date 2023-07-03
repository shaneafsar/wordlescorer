import type WordleData from '../../js/WordleData.js';
import type { SearchIndex } from 'algoliasearch';
import { 
    ETwitterStreamEvent, 
    TweetV2, 
    TwitterApi,  
    ApiV2Includes, 
    Tweetv2FieldsParams, 
    MediaObjectV2, 
    TweetV2SingleResult, 
    TwitterV2IncludesHelper, 
    TweetSearchV2StreamParams, 
    TweetV2SingleStreamResult,
    MentionEntityV1, 
    ReferencedTweetV2,
    TweetV1
} from 'twitter-api-v2';
import { calculateScoreFromWordleMatrix } from '../../js/calculate/calculate-score-from-wordle-matrix.js';
import { getSolvedRow } from '../../js/calculate/get-solved-row.js';
import isValidWordle from '../../js/calculate/is-valid-wordle.js';
import { getWordleNumberFromList } from '../../js/extract/get-wordle-number-from-text.js';
import getWordleMatrixFromList from '../../js/extract/get-wordle-matrix-from-list.js';
import checkIsSameDay from '../../js/is-same-day.js';
import getScorerGlobalStats from '../../js/db/get-scorer-global-stats.js';
import { getCompliment } from '../../js/display/get-compliment.js';
import { getSentenceSuffix } from '../../js/display/get-sentence-suffix.js';
import logError from '../../js/debug/log-error.js';
import logConsole from '../../js/debug/log-console.js';

const WORDLE_BOT_ID = '1422211304996155393';
const WORDLE_BOT_HANDLE = '@ScoreMyWordle';
const SINCE_ID = 'since_id';
const IS_DEVELOPMENT = process.env['NODE_ENV'] === 'develop';

const API_OPTIONS = {
    'tweet.fields': ['attachments', 'author_id','created_at','id','in_reply_to_user_id','text','referenced_tweets'],
    'media.fields': ['alt_text'],
    'user.fields': ['id', 'username','profile_image_url'],
    expansions: ['attachments.media_keys','author_id', 'in_reply_to_user_id', 'referenced_tweets.id'],
};

interface ProccessOptions {
    isGrowthTweet: boolean;
    isParent: boolean;
};

interface AlgoliaIndexObject {
    name: string;
    score: number;
    solvedRow: number;
    wordleNumber: number;
    date_timestamp: number;
    id: string;
    autoScore: boolean;
    scorerName: string;
    photoUrl: string;
}

function getAltTextList(medias: MediaObjectV2[]): string[] {
    return medias.map(media => {
        return media.alt_text || '';
    })
}

function getTweetText(tweet: TweetV1) {
    return tweet.full_text || tweet.text;
}

function convertTweetV1ToV2(tweetV1: TweetV1): TweetV2SingleResult {
    const mentionsV1: MentionEntityV1[] = tweetV1.entities.user_mentions || [];
    const referenced_tweets: ReferencedTweetV2[] = [{ type: 'replied_to', id: tweetV1.in_reply_to_status_id_str || '' }];

    const tweetV2: TweetV2 = {
        referenced_tweets: tweetV1.in_reply_to_status_id ? referenced_tweets : [],
        text: getTweetText(tweetV1),
        id: tweetV1.id_str,
        author_id: tweetV1.user.id_str,
        created_at: tweetV1.created_at,
        in_reply_to_user_id: tweetV1.in_reply_to_user_id_str || '',
        edit_history_tweet_ids: [tweetV1.id_str]
    };

    const mentionTweets:TweetV2[] = [
        {
          text: '',
          id: tweetV1.in_reply_to_status_id_str || '',
          author_id: tweetV1.in_reply_to_user_id_str || '',
          created_at: '',
          edit_history_tweet_ids: [tweetV1.in_reply_to_status_id_str || '']
        }
    ];

    const includes: ApiV2Includes = {
        users: [
          {
            name: tweetV1.user.name,
            id: tweetV1.user.id_str,
            username: tweetV1.user.screen_name,
            profile_image_url: tweetV1.user.profile_image_url_https
          },
          ...mentionsV1.map((mention: MentionEntityV1) => ({
            name: mention.name,
            id: mention.id_str,
            username: mention.screen_name,
            profile_image_url: ''
          }))
        ],
        tweets: tweetV1.in_reply_to_status_id ? mentionTweets : [],
        media: tweetV1.extended_entities?.media?.length ? tweetV1.extended_entities?.media?.map(media => ({    
            media_key: media.id_str,
            type: media.type,
            alt_text: media.ext_alt_text
        } as MediaObjectV2)) : []
    };

    return {
        data: tweetV2,
        includes
    };
}

export default class TwitterWordleBot {
    private TOauth2: TwitterApi;
    private TOauth1: TwitterApi;
    private AlgoliaIndex: SearchIndex;

    private globalScores: WordleData;
    private userGrowth: WordleData;
    private analyzedPosts: WordleData;
    private users: WordleData;
    private lastMention: WordleData;
    private topScores: WordleData;

    private PROCESSING: Set<String> = new Set<String>();

    constructor(TOauth2: TwitterApi,
        TOauth1: TwitterApi,
        algoliaIndex: SearchIndex,
        globalScores: WordleData, 
        topScores: WordleData,
        userGrowth: WordleData,
        analyzedPosts: WordleData,
        users: WordleData,
        lastMention: WordleData) {

        this.TOauth2 = TOauth2;
        this.TOauth1 = TOauth1;

        this.AlgoliaIndex = algoliaIndex;

        this.globalScores = globalScores;
        this.topScores = topScores;
        this.userGrowth = userGrowth;
        this.analyzedPosts = analyzedPosts;
        this.users = users;
        this.lastMention = lastMention;
    }

    async initialize() {
        //await this.updateStreamRules();
        //await this.startStream();
        this.subscribeToMentionsV1();
    }

    // @ts-ignore
    private async updateStreamRules() {
        try {
            const rules = await this.TOauth2.v2.streamRules();
            if(rules.data?.length) {
                await this.TOauth2.v2.updateStreamRules({
                    delete: { ids: rules.data.map(rule => rule.id) },
                });
            }
            return await this.TOauth2.v2.updateStreamRules({
                add: [{ value: 'Wordle', tag: 'growth'}, { value: WORDLE_BOT_HANDLE, tag:'mention'} ],
            });
        } catch (e) {
            logError('failed to update stream rules | ', e);
            return Promise.reject();
        }
    }

    // @ts-ignore
    private async startStream() {
        try {
            const stream = await this.TOauth2.v2.searchStream(API_OPTIONS as Partial<TweetSearchV2StreamParams>);
            // Enable auto reconnect
            stream.autoReconnect = true;

            stream.on(ETwitterStreamEvent.Data, async result => {
                const hasBotMention = result.matching_rules.filter(rule => rule.tag === 'mention').length > 0;
                const isEligibleGrowthTweet = result.matching_rules.filter(rule => rule.tag === 'growth').length > 0;

                if (hasBotMention) {
                    this.lastMention.write(SINCE_ID, result.data.id);
                    this.processTweet(result, { isGrowthTweet: false, isParent: false });
                } else if (isEligibleGrowthTweet) {
                    this.handleGrowthTweet(result);
                }
            });
            return stream;
        } catch (e) {
            logError('failed to start stream | ', e);
            return Promise.reject();
        }
    }

    private handleGrowthTweet(result: TweetV2SingleStreamResult) {
        const resultIncludes = new TwitterV2IncludesHelper(result);
        const tweetV2 = result.data;

        const textContent = tweetV2.text || ''; 
        const postId = tweetV2.id;
        const author = resultIncludes.author(tweetV2);
        const screenName = '@' + author?.username;
        const userId = author?.id || '';
        const altTexts = getAltTextList(resultIncludes.medias(tweetV2));
        const listOfContent = [textContent, ...altTexts];
        const wordleMatrix = getWordleMatrixFromList(listOfContent);
        const solvedRow = getSolvedRow(wordleMatrix);
        // get the wordle number from the text
        const wordleNumber = getWordleNumberFromList(listOfContent);

        if (isValidWordle(wordleMatrix, wordleNumber, solvedRow)) {
            
            // get the wordle score
            const wordleScore = calculateScoreFromWordleMatrix(wordleMatrix).finalScore;

            // insert into global db if there is a wordle number
            // and solved row is valid

            this.globalScores.write(userId, {
                wordleNumber,
                wordleScore,
                solvedRow,
                tweetId: postId,
                userId,
                screenName
            });      

            this.processRandomTweet(userId, screenName, result);

        }
    }

    private processRandomTweet(userId: string, screenName: string, result: TweetV2SingleResult) {
        const timeAgo = new Date(new Date().getTime() + -30*60000);
        const randomNum = Math.floor(Math.random() * 5);

        // if there are no analyzed tweets in the last 30min, then
        // randomly decide to tweet reply

        if (randomNum === 0 && 
            this.userGrowth.hasKey('lastCheckTime') && 
            this.userGrowth.readSync('lastCheckTime').lastCheckTime <= timeAgo) {

            const lastCheckTime = { lastCheckTime: Date.now()};
            this.userGrowth.write('lastCheckTime', lastCheckTime);

            // Exit if already scored, we don't want to bother them!
            if (this.userGrowth.hasKey(userId) || this.userGrowth.hasKey(screenName)) {
                return;
            }

            this.userGrowth.write(userId, lastCheckTime);

            this.processTweet(result, {isGrowthTweet: true, isParent: false});
        }
    }


    private async processTweet(result: TweetV2SingleResult, options: ProccessOptions) {
        const { isGrowthTweet, isParent } = options;
        const tweet = result.data;
        const includes = new TwitterV2IncludesHelper(result);
        const id = tweet.id;
        const parentUserId = tweet.in_reply_to_user_id;
        let parentId:string | undefined = '';
        if(parentUserId) {
            parentId = tweet.referenced_tweets?.[0]?.id
        }
        const tweetText = tweet.text;
        const author = includes.author(tweet);
        const name = author?.name || '';
        const userId = author?.id || '';
        const photo = TwitterApi.getProfileImageInSize(author?.profile_image_url || '', 'bigger');
        const createdAt = new Date(tweet.created_at || '');
        const createdAtMs = createdAt.getTime();
        const isSameDay = checkIsSameDay(createdAt);
        const altTexts = getAltTextList(includes.medias(tweet));
        const listOfContent = [tweetText, ...altTexts];


        this.userGrowth.write(userId, { lastCheckTime: Date.now()});
        /**
         * Bail early if this tweet has been processed or is 
         * processing.
         */  
        if(this.analyzedPosts.readSync(id) || this.PROCESSING.has(id)) {
            return;
        }
    
        this.PROCESSING.add(id);


        // Exit if this is a self-wordle debugging tweet (prevent multi-tweets)
        if(tweetText.indexOf('The wordle scored') > -1 || 
            tweetText.indexOf('Sorry, something went wrong.') > -1 ||
            userId === WORDLE_BOT_ID) {
            return;
        }

        const screenName = '@' + author?.username;


        const wordleResult = getWordleMatrixFromList(listOfContent);
        const wordleNumber = getWordleNumberFromList(listOfContent);
        const solvedRow = getSolvedRow(wordleResult);

        if(isValidWordle(wordleResult, wordleNumber, solvedRow)) {
            
            const score = calculateScoreFromWordleMatrix(wordleResult).finalScore;
            

            /**
             * Add to today's scores if tweet happened today
             * Only allow one score per user
             */
            if(isSameDay && userId) {
                this.topScores.write(userId, {
                    screenName,
                    score,
                    solvedRow,
                    datetime: createdAtMs,
                    autoScore: isGrowthTweet,
                    wordleNumber
                });
            }

            /**
             * Make sure this is included as a part of the global scores
             * Growth tweets write to global stores before they get here, 
             * hence the check.
             * Only allows one per user per day.
             */
            if(!isGrowthTweet && userId) {
                this.globalScores.write(userId, {
                    wordleNumber,
                    wordleScore: score,
                    solvedRow,
                    tweetId: id,
                    userId,
                    screenName
                });
            }
 
            try {
                const { wordlePrefix, aboveTotal } = await getScorerGlobalStats({solvedRow, wordleNumber, date: new Date()}, this.globalScores);
                const status = this.buildStatus(screenName, wordlePrefix, score, solvedRow, aboveTotal, isGrowthTweet);

                this.sendReply(status, id);

                const analyzedTweet = {
                    name,
                    score,
                    solvedRow,
                    wordleNumber,
                    date_timestamp: Math.floor(Date.now() / 1000),
                    id,
                    autoScore: isGrowthTweet,
                    scorerName: screenName
                };

                this.analyzedPosts.write(id, analyzedTweet);
            
                if(name && photo && userId) {
                    this.users.write(userId, {
                        user_id: userId,
                        screen_name: screenName.substring(1),
                        photo: photo
                    });
                }
                
                this.addToIndex({
                    ...analyzedTweet,
                    photoUrl: photo || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'
                });

            } catch(e) {
                logError('failed to get globalScorerGlobalStats | ', e);
            } finally {
                this.PROCESSING.delete(id);
            }
            
        } else if (parentId && 
            !isGrowthTweet && 
            !isParent && 
            !this.analyzedPosts.hasKey(parentId) && 
            !this.PROCESSING.has(parentId)) {
            
            try {
                const result = await this.TOauth2.v2.tweets([parentId], API_OPTIONS as Tweetv2FieldsParams);
                logConsole(result);
                if(result.data?.length > 0) {
                    const includes = result.includes as ApiV2Includes;
                    this.processTweetList(result.data, includes, {isGrowthTweet, isParent: true});
                }
                if(result.errors) {
                    logError('errors related to parent tweet, response |', result.errors);
                }
            } catch(e) {
                logError('error finding parent tweet, request failed |', e);
            } finally {
                this.PROCESSING.delete(id);
            }
        }
        // If there's no parent or it's a growth tweet, then there's nothing else to check. Bail out!
    }

    /**
     * Process a list of tweets from the V2 API
     * @param tweets {TweetV2[]} tweets to iterate through and process
     * @param includes {ApiV2Includes} includes from v2 API response
     * @param options {ProcessOptions} options to pass to each tweet processed
     */
    private processTweetList(tweets: TweetV2[], includes: ApiV2Includes, options: ProccessOptions) {
        for(const singleTweet of tweets) {
            const singleResult = {
                data: singleTweet,
                includes
            };
            this.processTweet(singleResult, options);
        }
    }

    /**
     * @param status {string} post text to publish
     * @param id {string} id of tweet to reply or quote tweet (if a community tweet)
     */
    private sendReply(status: string, id: string) {
        if(!IS_DEVELOPMENT) {
            this.TOauth1.v2.reply(status, id).then(result => {
                logConsole(`Tweeted: ${result.data.text} to ${result.data.id} | parent: ${id}`);
            }).catch((e) => {
                logError('TOauth1.v2.reply error | ', e);
                if(e.data?.detail === 'You are not permitted to create a non Community Tweet in reply to a Community Tweet.' ||
                    e.data?.detail === 'Reply to a community tweet must also be a community tweet') {
                        
                    this.TOauth1.v2.quote(status, id).then(quoteResult => {
                        logConsole(`Quoted: ${quoteResult.data.text} to ${quoteResult.data.id}`);
                    }).catch((quoteError) => {
                        logError('TOauth1.v2.quote error | ', quoteError);
                    });

                }
            });
        } else {
            logConsole(`TwitterBot devmode tweet: ${status} to ${id}`);
        }
    }

    private addToIndex(objectToIndex: AlgoliaIndexObject) {
        if(!IS_DEVELOPMENT) {
            this.AlgoliaIndex.saveObjects([objectToIndex], { autoGenerateObjectIDIfNotExist: true })
            .catch((e) => {
                logError('Algolia saveObjects error | ', e);
            });
        }
    }

    /**
    private async subscribeToMentionsV2() {
        const lastMentionId = this.lastMention.readSync(SINCE_ID) as string;
        if (!IS_DEVELOPMENT && lastMentionId) {
            setInterval(async () =>{
                const mentionsTimeline = await this.TOauth2.v2.userMentionTimeline(WORDLE_BOT_ID, {
                    max_results: 100,
                    since_id: lastMentionId || '',
                    ...API_OPTIONS as Tweetv2FieldsParams
                });

                if(mentionsTimeline.tweets.length > 0) {
                    if(mentionsTimeline.tweets[0]?.id) {
                        this.lastMention.write(SINCE_ID, mentionsTimeline.tweets[0]?.id);
                    }
                    const includes = mentionsTimeline.data.includes as ApiV2Includes;
                    this.processTweetList(mentionsTimeline.tweets, 
                        includes,
                        {isGrowthTweet: false, isParent: false});
                }

                if(mentionsTimeline.errors.length > 0) {
                    logError('mentions fetch error(s) | ', mentionsTimeline.errors);
                }
            }, 60000);
        }
    }
    */

    /**
     * Reading mentions since communities is not availble via API
     * API docs inticate rate-limit of 180 requests per 15-minute window per each authenticated user (every 12s)
     */
    private subscribeToMentionsV1() {
        setInterval(async () => {
            try {
                const lastMentionId = this.lastMention.readSync(SINCE_ID) as string;
                const mentionsV1Tweets = await this.TOauth1.v1.mentionTimeline({
                    tweet_mode: 'extended', 
                    since_id: lastMentionId, 
                    count: 200,
                    include_entities: true 
                });
                if(mentionsV1Tweets.tweets.length > 0) {
                    const tweetId = mentionsV1Tweets.tweets[0]?.id_str || '';

                    if(!this.PROCESSING.has(tweetId) && !this.analyzedPosts.hasKey(tweetId)) {

                        this.lastMention.write(SINCE_ID, mentionsV1Tweets.tweets[0]?.id_str);

                        mentionsV1Tweets.tweets.forEach(tweet => {
                            const tweetV2 = convertTweetV1ToV2(tweet);
                            this.processTweet(tweetV2, {isGrowthTweet: false, isParent: false});
                        });

                    }
                }
            } catch(e) {
                logError('subscribeToMentionsV1 | Error retrieving mentions | ', e);
            }
        }, 60000);
    }

    private buildStatus(name: string, wordlePrefix: string, score: number, solvedRow: number, aboveTotal: string, isGrowth: boolean) {
        return `${name} This ${wordlePrefix} scored ${score} out of 360${getSentenceSuffix(solvedRow)} ${aboveTotal} ${getCompliment(isGrowth)}`;
    }

}
