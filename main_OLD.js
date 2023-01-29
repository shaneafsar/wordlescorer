import Twit from 'twit';
import { TwitterApi } from 'twitter-api-v2';
import dotenv  from 'dotenv';
import WordleData from './js/WordleData.js/index.js';
import checkIsSameDay from './js/is-same-day.js';
import getWordleNumberFromText from './js/extract/get-wordle-number-from-text.js';
import getWordleMatrixFromText from './js/extract/get-wordle-matrix-from-text.js';
import getWordleMatrixFromImageAltText from './js/extract/get-wordle-matrix-from-image-alt-text.js'
import getGlobalStats from './js/db/get-global-stats.js';
import getTopScorerInfo from './js/db/get-top-scorer-info.js';
import getFormattedGlobalStats from './js/display/get-formatted-global-stats.js';
import getTopScoreDB from './js/db/get-top-score-DB.js';
import getGlobalScoreDB from './js/db/get-global-score-DB.js';
import isValidWordle from './js/calculate/is-valid-wordle.js';
import getScorerGlobalStats from './js/db/get-scorer-global-stats.js';
import { WORDLE_BOT_ID, WORDLE_BOT_HANDLE } from './js/const/WORDLE-BOT.js';
import logError from './js/debug/log-error.js';
import initServer from "./web/init-server.js";
import algoliasearch from 'algoliasearch';
import { calculateScoreFromWordleMatrix } from './js/calculate/calculate-score-from-wordle-matrix.js';
import { getCompliment } from './js/display/get-compliment.js';
import { getSolvedRow } from './js/calculate/get-solved-row.js';
import { getSentenceSuffix } from './js/display/get-sentence-suffix.js';
import { getFormattedDate } from './js/display/get-formatted-date.js';
import { setDelayedFunction } from './js/set-delayed-function.js';
import { login } from 'masto';
import MastoWordleBot from './MastoWordleBot.js';
import TwitterWordleBot from './TwitterWordleBot.js';

var RUN_GROWTH = true;
var isDevelopment = process.env['NODE_ENV'] === 'develop';

/**
 * Load env variables from filesystem when developing
 */
if (isDevelopment) {
  dotenv.config();
  RUN_GROWTH = false;
};

const TWIT_CONFIG = {
  consumer_key: process.env['consumer_key'],
  consumer_secret: process.env['consumer_secret'],
  access_token: process.env['access_token'],
  access_token_secret: process.env['access_token_secret'],
};

const AnalyzedTweetsDB = new WordleData('analyzed');
const UsersDB = new WordleData('users');
const LastMentionDB = new WordleData('last-mention');
const UserGrowthDB = new WordleData('user-growth');
var TopScoresDB = getTopScoreDB();
var GlobalScoresDB = getGlobalScoreDB();

const PROCESSING = {};

var T = new Twit(TWIT_CONFIG);

if(isDevelopment) {
  T.post = function() { console.log('NOT TWEETING, DEVELOPMENT MODE | ', arguments); };
}

const ALGOLIA = algoliasearch(process.env['algolia_app_id'] || '', process.env['algolia_admin_key'] || '');
const ALG_INDEX = ALGOLIA.initIndex('analyzedwordles');


await AnalyzedTweetsDB.loadData();
const LAST_MENTION = await LastMentionDB.read('');
await UserGrowthDB.loadData();
await GlobalScoresDB.loadData();
await UsersDB.loadData();

setDelayedFunction(tweetDailyTopScore);
setDelayedFunction(tweetGlobalStats);

async function initTwitterBot(globalScores, topScores) {
  const userGrowth = new WordleData('user-growth');
  const analyzedPosts = new WordleData('analyzed');
  const users = new WordleData('users');
  const lastMention = new WordleData('last-mention');
  /*const twitterClient = new Twit({
    consumer_key: process.env['consumer_key'],
    consumer_secret: process.env['consumer_secret'],
    access_token: process.env['access_token'],
    access_token_secret: process.env['access_token_secret'],
  });*/
  const twitterClient = new TwitterApi({
    appKey: TWIT_CONFIG.consumer_key,
    appSecret: TWIT_CONFIG.consumer_secret,
    accessToken: TWIT_CONFIG.access_token,
    accessSecret: TWIT_CONFIG.access_token_secret
  });
  await globalScores.loadData();
  await topScores.loadData();
  await userGrowth.loadData();
  await analyzedPosts.loadData();
  await users.loadData();
  await lastMention.loadData();

  return new TwitterWordleBot(
    twitterClient, 
    globalScores, 
    topScores,
    userGrowth,
    analyzedPosts,
    users,
    lastMention);
}

async function initMastoBot(globalScores, topScores) {
  const userGrowth = new WordleData('user-growth_masto');
  const analyzedPosts = new WordleData('analyzed_masto');
  const users = new WordleData('users_masto');
  const lastMention = new WordleData('last-mention_masto');
  const mastoClient = await login({
    url: process.env['MASTO_URI'] || '',
    accessToken: process.env['MASTO_ACCESS_TOKEN'] || '',
  });
  await globalScores.loadData();
  await topScores.loadData();
  await userGrowth.loadData();
  await analyzedPosts.loadData();
  await users.loadData();
  await lastMention.loadData();

  return new MastoWordleBot(
    mastoClient, 
    globalScores, 
    topScores,
    userGrowth,
    analyzedPosts,
    users,
    lastMention);
}


var stream = T.stream('statuses/filter', { track: WORDLE_BOT_HANDLE });
stream.on('tweet', processTweet);

// Let the world know we exist!
if(RUN_GROWTH) {
  
  var growthStream = T.stream('statuses/filter', { track: 'Wordle' });
  growthStream.on('tweet', function(tweet) {

    // get the wordle matrix from the tweet text
    var wordleMatrix = getWordleMatrixFromText(tweet.text);
    var solvedRow = getSolvedRow(wordleMatrix);
    if (wordleMatrix.length !== 0 && isValidWordle(wordleMatrix)) {

      const userId = tweet.user.id_str;
      const screenName = '@' + tweet.user.screen_name;
      
      // get the wordle number from the text
      var wordleNumber = getWordleNumberFromText(tweet.text);
     
      // get the wordle score
      var wordleScore = calculateScoreFromWordleMatrix(wordleMatrix).finalScore;

      // insert into global db if there is a wordle number
      // and solved row is valid
      if(wordleNumber && solvedRow < 7) {
        var scoreObj = {
          wordleNumber,
          wordleScore,
          solvedRow,
          tweetId: tweet.id_str,
          userId,
          screenName
        };

        GlobalScoresDB.write(userId, scoreObj);      

        const timeAgo = new Date(new Date().getTime() + -30*60000);
        const randomNum = Math.floor(Math.random() * 5);
      
        // if there are no analyzed tweets in the last 30min, then
        // randomly decide to tweet reply
  
        if (randomNum === 0 && 
          UserGrowthDB.hasKey('lastCheckTime') && 
          UserGrowthDB.readSync('lastCheckTime').lastCheckTime <= timeAgo) {

          const lastCheckTime = { lastCheckTime: Date.now()};
          UserGrowthDB.write('lastCheckTime', lastCheckTime);
  
          // Exit if already scored, we don't want to bother them!
          if (UserGrowthDB.hasKey(userId) || UserGrowthDB.hasKey(screenName)) {
            return;
          }

          UserGrowthDB.write(userId, lastCheckTime);

          processTweet(tweet, true);
        }
      }
    }
  });
}

/**
 * Reading mentions since communities is not availble via API yet
 * API docs inticate rate-limit of 75 calls per 15min (12s per call).
 */
if (!isDevelopment && LAST_MENTION.since_id) {
  setInterval(() => {
    T.get('statuses/mentions_timeline', { 
      since_id: LAST_MENTION.since_id, 
      count: 200,
      include_entities: true
    }).then(({data}) => {
      if(data.length > 0) {
        LAST_MENTION['since_id'] = data[0].id_str;
        LastMentionDB.write('since_id', data[0].id_str);  
        data.forEach((tweet) => { 
          processTweet(tweet);
        });
      } else {
        // console.log(`no more mentions as of ${new Date().toUTCString()}`);
      }
    });
  }, 60000);
}

/**
 * Check if day has ended, tweet top results
 */
async function tweetGlobalStats(date) {
  var stats = await getGlobalStats(date);
  var formattedStats = getFormattedGlobalStats(stats);
  formattedStats.forEach((item, index) => {
    setTimeout(() => {
      T.post('statuses/update', { 
        status: item
      }, (err, reply) => {
        if(err) {
          console.log('error tweeting gloabl stats: ', err);
        }
      });
    }, (60000*[index+1]));
  });

  // Run again for tomorrow!
  setDelayedFunction(tweetGlobalStats);
}

/**
 * Check if day has ended, tweet top results
 */
async function tweetDailyTopScore(date) {
  var scorer = await getTopScorerInfo(date);
  var finalStatus = 'Not sure -- nobody requested a score today :(';
  
  if(scorer) {
    finalStatus = `${scorer.name}! They scored ${scorer.score} points for Wordle ${scorer.wordleNumber} and solved it on row ${scorer.solvedRow}! That's better than ${scorer.aboveTotal} (~${scorer.percentage}) other users. ${getCompliment()}`;

    T.post('statuses/update', { 
      status: `The top scorer for ${getFormattedDate(date)} is: ${finalStatus}`
    }, (err, reply) => {
      if(err) {
        console.log('error tweeting top score: ', err);
      }
    });
  }

  // Run again for tomorrow!
  setDelayedFunction(tweetDailyTopScore);

  // Reset the write DBs
  TopScoresDB = getTopScoreDB();
  GlobalScoresDB = getGlobalScoreDB();
}

function processTweet(tweet, isGrowthTweet, isReplay) {
  const id = tweet.id_str;
  const parentId = tweet.in_reply_to_status_id_str;
  const tweetText = tweet.text;
  const userId = tweet.user.id_str;
  const photo = tweet.user.profile_image_url_https;
  const createdAt = new Date(tweet.created_at);
  const createdAtMs = createdAt.getTime();
  const isSameDay = checkIsSameDay(createdAt);

  if (!isReplay) {
    UserGrowthDB.write(userId, { lastCheckTime: Date.now()});
    /**
     * Bail early if this tweet has been processed or is 
     * processing.
     */  
    if(AnalyzedTweetsDB.readSync(id) || PROCESSING[id]) {
      return;
    }
  
    PROCESSING[id] = true;
  }

  // Exit if this is a self-wordle debugging tweet (prevent multi-tweets)
  if(tweetText.indexOf('The wordle scored') > -1 || 
    tweetText.indexOf('Sorry, something went wrong.') > -1 ||
    userId === WORDLE_BOT_ID) {
    return;
  }

  var screenName = '@' + tweet.user.screen_name;
  var altText = tweet.extended_entities?.media?.[0]?.description || '';
  var wordleResult = getWordleMatrixFromText(tweetText);
  var wordleNumber = getWordleNumberFromText(tweetText);

  // Try alt text if there's no wordle result in main text
  if (wordleResult.length === 0) {
    if(!altText) {
      altText = tweet.extended_entities?.media?.[0]?.ext_alt_text || '';
    }
    wordleResult = getWordleMatrixFromImageAltText(altText);
    wordleNumber = getWordleNumberFromText(altText);
  }

  /**
   * Check @ mentioned tweet text & alt text.
   * Bail out if this a growth tweet.
   * If there's no wordle, check the parent tweet.
   * If there's no wordle on the parent tweet, bail out.
   */
  const wordleResultPromise = new Promise((resolve, reject) => {
    // If @mention tweet & alt text contains no wordle text, then try checking
    // the parent tweet.
    if(isValidWordle(wordleResult)) {
      resolve({ 
        wordle: wordleResult, 
        wordleNumStr: wordleNumber,
        id: id,
        name: screenName,
        userId: userId,
        scorerUserId: userId,
        scorerName: screenName,
        scorerPhoto: photo,
        scorerTweetId: id,
        datetime: createdAtMs,
        isGrowthTweet
      });

     // If there's a parent Id and not a growth tweet, then continue.
    } else if (parentId && isGrowthTweet !== true) {


        /**
         * Bail early if the parent tweet has been processed or is 
         * processing.
         */
        if(!isReplay && 
          (AnalyzedTweetsDB.readSync(parentId) || PROCESSING[parentId])) { 
          reject({
            name: screenName,
            id: id,
            parentId: parentId,
            message: 'already processed parentId',
            source: 'wordleResultPromise'
          });
          return;
        }

        
        T.get('statuses/show/:id', { id: parentId, include_ext_alt_text: true })
          .catch((err) => {

            reject({
              name: screenName,
              id: id,
              parentId: parentId,
              message: 'parentId request fail',
              source: 'wordleResultPromise'
            });
            
          })
          .then(({data}) => {
            const parentAltText = data?.extended_entities?.media?.[0]?.ext_alt_text || '';
            const parentTextContent = data.text;

            const parentWordleResult = getWordleMatrixFromOptions(parentTextContent, parentAltText);
            const parentWordleNumber = getWordleNumberFromText(parentTextContent) || getWordleNumberFromText(parentAltText);


            const parentUserId = data.user.id_str;
            const parentPhoto = data.user.profile_image_url_https;
            const parentName = '@' + data.user.screen_name;
            const parentTweetId = parentId;

            // Reject if there's no result from the text or the alt text on the parent
            if(isValidWordle(parentWordleResult)) {
              resolve({ 
                wordle: parentWordleResult,
                wordleNumStr: parentWordleNumber,
                id: id,
                name: screenName,
                userId: userId,
                scorerUserId: parentUserId,
                scorerName: parentName,
                scorerPhoto: parentPhoto,
                scorerTweetId: parentTweetId,
                datetime: createdAtMs,
                isGrowthTweet
              });
            } else {
              reject({
                name: screenName,
                id: id,
                source: 'wordleResultPromise',
                message: 'parent tweet has no wordle result'
              });
            }
          });
    } else {
      // If there's no parent or it's a growth tweet, then there's nothing else to check. Bail out!
      reject({
        name: screenName,
        id: id,
        source: 'wordleResultPromise',
        message: 'No wordleResult, no parentId or is growth tweet'
      });
    }
  });

  wordleResultPromise.then(({ 
    wordle, 
    wordleNumStr,
    id, 
    name, 
    userId,
    scorerUserId,
    scorerName,
    scorerPhoto,
    scorerTweetId, 
    datetime,
    isGrowthTweet}) => {
    const score = calculateScoreFromWordleMatrix(wordle).finalScore;
    const solvedRow = getSolvedRow(wordle);

    /**
     * Add to today's scores if tweet happened today
     * Only allow one score per user
     */
    if(isSameDay) {
      TopScoresDB.write(scorerUserId, {
        name: scorerName,
        score,
        solvedRow,
        datetime,
        autoScore: isGrowthTweet,
        wordleNumber: wordleNumStr
      });
    }

    getScorerGlobalStats({solvedRow, wordleNumber: wordleNumStr, date: new Date()}).then(({wordlePrefix, aboveTotal}) => {
      if (!isReplay && !AnalyzedTweetsDB.readSync(id)) {

        const status = `${name} This ${wordlePrefix} scored ${score} out of 360${getSentenceSuffix(solvedRow)} ${aboveTotal} ${getCompliment(isGrowthTweet)}`;

        T.post('statuses/update', { 
          status, 
          in_reply_to_status_id: id, 
          auto_populate_reply_metadata: true 
        }, (err, reply) => {

          handlePostCallback({
            name,
            score,
            solvedRow,
            wordleNumber: wordleNumStr,
            date_timestamp: Math.floor(Date.now() / 1000),
            id: id,
            autoScore: isGrowthTweet,
            scorerName
          },{
            scorerName,
            scorerPhoto,
            scorerUserId
          });

          if(err) {
            logError('reply error: ', id, name, score, solvedRow, err);
            /**
             * Hack for Twitter Communities (no API yet)
             */
            if(err.message === 'Reply to a community tweet must also be a community tweet') {
              replyToCommunityTweet(status, name, id);
            }
          } else {
            console.log(`Tweeted: ${reply.text} to ${reply.in_reply_to_status_id_str}`);
          }
        }); 
      }
    }).catch(function(obj) {
      if (obj.name && obj.id) {
        AnalyzedTweetsDB.write(obj.id, {
          name: obj.name
        });
        logError(' getScorerGlobalStats failure ', obj);
      } else {
        logError(' no name or postId to write to DB ', obj);
      }
    });
  }).catch(logError);
}

function replyToCommunityTweet(status, name, id) {
  console.log('*** Attempting to quote tweet for community *** ');
  T.post('statuses/update', { 
    status: status, 
    attachment_url: `https://twitter.com/${name.substring(1)}/status/${id}`
  }, (err, reply) => {
    if(err) {
      logError(' failed to quote tweet ', err);
    } else {
      console.log(`Tweeted: ${reply.text} to ${reply.in_reply_to_status_id_str}`);
    }
  });
}


/**
 * Handle post reply data saving
 * @param {Object[]} analyzedTweet
 * @param {string} analyzedTweet[].id - reply id
 * @param {string} analyzedTweet[].name - tweet requester account name
 * @param {string} analyzedTweet[].scorerName - scorer account name
 * @param {number} analyzedTweet[].score - calculated score
 * @param {number} analyzedTweet[].solvedRow
 * @param {boolean} analyzedTweet[].autoScore
 * @param {string} analyzedTweet[].wordleNumber - wordle number
 * @param {number} analyzedTweet[].date_timestamp
 * @param {Object[]} scorer
 * @param {string} scorer[].scorerPhoto - url to profile photo
 * @param {string} scorer[].scorerUserId - user id of scorer
 * @param {string} scorer[].scorerName - scorer account name
 */
function handlePostCallback(analyzedTweet, scorer) {

  AnalyzedTweetsDB.write(analyzedTweet.id, analyzedTweet);

  const { scorerPhoto, scorerUserId, scorerName } = scorer;
  // Add users photo to the db
  if(scorerPhoto && scorerName && scorerUserId) {
    UsersDB.write(scorerUserId, {
      user_id: scorerUserId,
      screen_name: scorerName.substring(1),
      photo: scorerPhoto
    });
  }
  
  const algoliaObject = {
    ...analyzedTweet,
    photoUrl: scorerPhoto || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png'
  };
  
  if(!isDevelopment) {
    ALG_INDEX.saveObjects([algoliaObject], { autoGenerateObjectIDIfNotExist: true })
    .catch(logError);
  }
}

// ****************
// EXPRESS SERVER
// ****************

initServer();
