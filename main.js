import Twit from 'twit';
import dotenv  from 'dotenv';
import WordleData from './WordleData.js';
import getMultiplier from './utils/get-multiplier.js';
import checkIsSameDay from './utils/is-same-day.js';
import getWordleNumberFromText from './utils/get-wordle-number-from-text.js';
import getWordleMatrixFromText from './utils/get-wordle-matrix-from-text.js';
import getGlobalStats from './utils/get-global-stats.js';
import getTopScorerInfo from './utils/get-top-scorer-info.js';
import getFormattedGlobalStats from './utils/get-formatted-global-stats.js';
import getTopScoreDB from './utils/get-top-score-DB.js';
import getGlobalScoreDB from './utils/get-global-score-DB.js';
import isValidWordle from './utils/is-valid-wordle.js';
import getScorerGlobalStats from './utils/get-scorer-global-stats.js';
import { SCORE } from './const/SCORE-CONST.js';
import COMPLIMENTS from './const/COMPLIMENTS.js';
import { WORDLE_BOT_ID, WORDLE_BOT_HANDLE } from './const/WORDLE-BOT.js';
import logError from './utils/log-error.js';
import initServer from "./server/init-server.js";
import algoliasearch from 'algoliasearch';


const RUN_GROWTH = true;

/**
 * Load env variables from filesystem when developing
 */
if (process.env.NODE_ENV === "develop") {
  dotenv.config();
};


const TWIT_CONFIG = {
  consumer_key: process.env.consumer_key,
  consumer_secret: process.env.consumer_secret,
  access_token: process.env.access_token,
  access_token_secret: process.env.access_token_secret,
};

const AnalyzedTweetsDB = new WordleData('analyzed');
const UsersDB = new WordleData('users');
const LastMentionDB = new WordleData('last-mention');
const UserGrowthDB = new WordleData('user-growth');
var TopScoresDB = getTopScoreDB();
var GlobalScoresDB = getGlobalScoreDB();

const PROCESSING = {};

var T = new Twit(TWIT_CONFIG);

const ALGOLIA = algoliasearch(
  process.env.algolia_app_id, 
  process.env.algolia_admin_key);
const ALG_INDEX = ALGOLIA.initIndex('analyzedwordles');


const REPLY_HASH = await AnalyzedTweetsDB.read();
const LAST_MENTION = await LastMentionDB.read();
const USER_GROWTH_HASH = await UserGrowthDB.read();
const GLOBAL_SCORE_HASH = await GlobalScoresDB.read();
const USERS_HASH = await UsersDB.read();
var FINAL_SCORE_TIMEOUT = setDailyTopScoreTimeout(tweetDailyTopScore);
var FINAL_GLOBAL_STATS_TIMEOUT = setDailyTopScoreTimeout(tweetGlobalStats);


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
      var wordleScore = calculateScoreFromWordleMatrix(wordleMatrix).finalScore

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

  
        updateGlobalScores(scoreObj);
      

        const timeAgo = new Date(new Date().getTime() + -30*60000);
        const randomNum = Math.floor(Math.random() * 5);
      
        // if there are no analyzed tweets in the last 30min, then
        // randomly decide to tweet reply
  
        if (randomNum === 0 && USER_GROWTH_HASH['lastCheckTime']?.lastCheckTime <= timeAgo) {
          var lastCheckTime = { lastCheckTime: Date.now()};
          UserGrowthDB.write('lastCheckTime', lastCheckTime);
          UserGrowthDB.write(userId, lastCheckTime);
          // Exit if already scored, we don't want to bother them!
          if (USER_GROWTH_HASH[userId] || USER_GROWTH_HASH[screenName]) {
            return;
          }
          USER_GROWTH_HASH[userId] = lastCheckTime;
          USER_GROWTH_HASH['lastCheckTime'] = lastCheckTime;
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
setInterval(() => {
  T.get('statuses/mentions_timeline', { 
    since_id: LAST_MENTION.since_id || '1526808148031447042', 
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

function getFormattedDate(date) {
  let options = { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  };

  options.timeZone = 'UTC';
  options.timeZoneName = 'short';

  return date.toLocaleString('en-US', options);
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
  FINAL_GLOBAL_STATS_TIMEOUT = setDailyTopScoreTimeout(tweetGlobalStats);
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
  FINAL_SCORE_TIMEOUT = setDailyTopScoreTimeout(tweetDailyTopScore);

  // Reset the write DBs
  TopScoresDB = getTopScoreDB();
  GlobalScoresDB = getGlobalScoreDB();
}

/**
1. This function takes an argument called tweetFunc
 2. It then creates a new Date object called finalTime, and sets the time to 24 hours from now
 3. Then it creates a new Date object called currentDate, and gets the current time in milliseconds
 4. Then it logs a message to the console that says how many hours until the final score
*/
function setDailyTopScoreTimeout(tweetFunc) {
  const finalTime = new Date().setUTCHours(24,0,0,0);
  const currentDate = new Date();
  const currentTime = currentDate.getTime();
  console.log(`\n *** \n ${tweetFunc.name} happening in about ${((finalTime - currentTime)/1000/60/60).toFixed(2)} hours \n *** \n`);
  return setTimeout(() => {
    tweetFunc(currentDate);
  }, finalTime - currentTime);
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
    if(REPLY_HASH[id] || PROCESSING[id]) {
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
    if(wordleResult.length === 0) {
      
      // If there's no parent tweet && not a growth tweet, then bail out.
      if (parentId && isGrowthTweet !== true) {

        /**
         * Bail early if the parent tweet has been processed or is 
         * processing.
         */
        if(!isReplay) {
          if(REPLY_HASH[parentId] || PROCESSING[parentId]) {
            reject({
              name: screenName,
              id: id,
              parentId: parentId,
              message: 'already processed parentId',
              source: 'wordleResultPromise'
            });
            return;
          }
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
            var parentAltText = data?.extended_entities?.media?.[0]?.ext_alt_text || '';
            var parentWordleResult = getWordleMatrixFromText(data.text);
            var parentWordleNumber = getWordleNumberFromText(data.text);

            parentWordleResult = parentWordleResult.length > 0 ? 
              parentWordleResult : getWordleMatrixFromImageAltText(parentAltText);

            parentWordleNumber = parentWordleResult.length > 0 ? 
              parentWordleNumber : getWordleNumberFromText(parentAltText);

            var parentUserId = data.user.id_str;
            var parentPhoto = data.user.profile_image_url_https;
            var parentName = '@' + data.user.screen_name;
            var parentTweetId = parentId;

            // BUG: Need to refactor to include parent tweet context

            // Reject if there's no result from the text or the alt text on the parent
            if(parentWordleResult.length === 0) {
              reject({
                name: screenName,
                id: id,
                source: 'wordleResultPromise',
                message: 'parent tweet has no wordle result'
              })
            } else {
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
            }
          });
      } else {
        // If there's no parent or it's a growth tweet, then there's nothing else to check. Bail out!
        reject({
          name: screenName,
          id: id,
          source: 'wordleResultPromise',
          message: 'No parentId or is growth tweet'
        });
      }
    } else {
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
     */
    if(isSameDay) {
      updateTopScores({ 
        name: scorerName, 
        userId: scorerUserId,
        wordleNumber: wordleNumStr,
        score, 
        solvedRow, 
        datetime,
        isGrowthTweet
      });
    }

    getScorerGlobalStats({solvedRow, wordleNumber: wordleNumStr, date: new Date()}).then(({wordlePrefix, aboveTotal}) => {
      if (!isReplay) {
        tweetIfNotRepliedTo({
          name: name,
          score: score,
          solvedRow: solvedRow,
          wordleNumber: wordleNumStr,
          status: `${name} This ${wordlePrefix} scored ${score} out of 360${getSentenceSuffix(solvedRow)} ${aboveTotal} ${getCompliment(isGrowthTweet)}`,
          id: id,
          isGrowthTweet,
          scorerName,
          scorerPhoto,
          scorerUserId
        });  
      }
    }).catch(function(obj) {
      if (obj.name && obj.id) {
        AnalyzedTweetsDB.write(obj.id, {
          name: obj.name
        });
        logError(' getScorerGlobalStats failure ', obj);
      } else {
        logError('unable to tweet reply failure: ', obj);
      }
    });
  }).catch(logError);
}


async function updateGlobalScores({
    wordleNumber,
    wordleScore,
    solvedRow,
    tweetId,
    userId,
    screenName,
  }) {
  const scoreObj = {
    wordleNumber,
    wordleScore,
    solvedRow,
    tweetId,
    userId,
    screenName,
  };
  GLOBAL_SCORE_HASH[userId] = scoreObj;
  return await GlobalScoresDB.write(userId, scoreObj);
}

async function updateTopScores({name, score, solvedRow, userId, datetime, isGrowthTweet, wordleNumber}) {
  /**
   * Only allow one score per user
   */
  return await TopScoresDB.write(userId, {
      name,
      score,
      solvedRow,
      datetime,
      autoScore: isGrowthTweet,
      wordleNumber
    });
}


/**
 * Returns a compliment.
 * TODO: Consider adjusting to different ones based on score?
 * @returns {string} a compliment :)
 */
function getCompliment(isGrowthTweet) {
  const length = COMPLIMENTS.length;
  return COMPLIMENTS[Math.floor(Math.random() * length)] + (isGrowthTweet ? ' Mention me in the future, I <3 wordles!' : '');
}

/**
 * Tweet reply with score/error if it hasn't been recently replied to
 * @param {Object[]} content
 * @param {string} content[].status - tweet text
 * @param {string} content[].id - reply id
 * @param {string} content[].name - tweet requester account name
 * @param {string} content[].scorerName - scorer account name
 * @param {number} content[].score - calculated score
 * @param {number} content[].solvedRow
 * @param {boolean} content[].isGrowthTweet
 * @param {string} content[].wordleNumber - wordle number
 * @param {string} content[].scorerPhoto - url to profile photo
 * @param {string} content[].scorerUserId - user id of scorer
 */
function tweetIfNotRepliedTo({status, id, name, scorerName, score, solvedRow, isGrowthTweet, wordleNumber, scorerPhoto, scorerUserId}) {
  if(!REPLY_HASH[id]) {
    T.post('statuses/update', { 
      status: status, 
      in_reply_to_status_id: id, 
      auto_populate_reply_metadata: true 
    }, (err, reply) => {
      REPLY_HASH[id] = true;
        if (err) {
          logError(err);
          /**
           * Hack for Twitter Communities (no API yet)
           */
          if(err.message === 'Reply to a community tweet must also be a community tweet') {
            console.log('*** Attempting to quote tweet for community *** ');
            T.post('statuses/update', { 
              status: status, 
              attachment_url: `https://twitter.com/${name.substring(1)}/status/${id}`
            }, (err, data) => {
              if(err) {
                logError(' failed to quote tweet ', err);
              }
            });
        }
        logError('reply error: ', id, name, score, solvedRow, err);
      } else {
        console.log(`Tweeted: ${reply.text} to ${reply.in_reply_to_status_id_str}`);
      }

      let analyzedTweet = {
        name: name,
        scorerName,
        score: score,
        solvedRow: solvedRow,
        autoScore: isGrowthTweet,
        wordleNumber,
        id
      };

      AnalyzedTweetsDB.write(id, analyzedTweet);

      // Add users photo to the db
      if(scorerPhoto && scorerUserId && !USERS_HASH[scorerUserId]) {
        UsersDB.write(scorerUserId, {
          user_id: scorerUserId,
          screen_name: scorerName.substring(1),
          photo: scorerPhoto
        });
      }

      analyzedTweet.photoUrl = scorerPhoto || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';
      
      ALG_INDEX.saveObjects([analyzedTweet], { autoGenerateObjectIDIfNotExist: true })
      .catch(logError);
      
    });
  }
}

/**
 * getSolvedRow
 * @param {Number[]} wordle - score matrix
 * @returns {Number} 0-6
 */
function getSolvedRow(wordle) {
  if (!isValidWordle(wordle)) {
    return 0;
  }
  const lastFiveBlocks = wordle.slice(-5);
  if(lastFiveBlocks.filter((e) => e === SCORE.CORRECT).length !== 5) {
    return 0;
  }
  return wordle.length / 5;
}

/**
 * getSentenceSuffix
 * @param {Number} solvedRowNum 
 * @returns {String} 
 */
function getSentenceSuffix(solvedRowNum) {
  if(solvedRowNum === 0) {
    return '.';
  }
  return `, solved on row ${solvedRowNum}.`;
}

/**
 * Provides a bonus per square based on where the wordle was solved.
 * @param {Number} solvedRow - row number where a solve occured (must be between 1-6)
 * @returns {Number} integer bonus amount
 */
function getPointBonus(solvedRow) {
	var bonus = 0;
  var blocksPerRow = 5;
  var solvedBlockValue = SCORE.CORRECT;
  var i = solvedRow;
  for(; i<=5; i++) {
  	bonus += solvedBlockValue * blocksPerRow * getMultiplier((solvedRow*5)-1)
  }
  return bonus;
}

/**
 * Calculate score
 * @param {Number[]} wordle - array of numbers representing scores for each square
 * @returns {Object} {finalScore: number}
 */
function calculateScoreFromWordleMatrix(wordle) {
  var solvedRowBonus = getPointBonus(wordle.length / 5);
  var score = wordle.map((element, index) => {
    return element*getMultiplier(index);
  }).reduce((previous, current) => {
  	return previous+current;
  });
  return {finalScore: score + solvedRowBonus };
}


/**
 * Converts wa11y.co alt text to a wordle score matrix
 * @param {Stirng} text - alt text from wa11y.co
 * @returns {Number[]} array of scores
 */
 function getWordleMatrixFromImageAltText(text = '') {
  if(text.trim() === '') {
    return [];
  }

  // TODO: duck-type check the text for appropriate general format before continuing
   
  var lines = text.split('\n');

  const output = lines.map((line) => {
    var row = Array(5).fill(0, 0);
    
    // Nothing <-- empty row => line.match(/Nothing/gi)

    // all greens (perfect)
    if (!!line.match(/Won/g)) {
      row.fill(SCORE.CORRECT, 0);
    
    // 1-4 yellows
    } else if(!!line.match(/but in the wrong place/gi)) {
      var matches = line.match(/(?<=:.*)[1-5]/g);
      _rowUpdater(row, matches, SCORE.PARTIAL);

    // greens and yellows (mix of 1-4 greens, 1-4 yellows)
    } else if(line.indexOf('in the wrong place') > -1 && line.indexOf('perfect') > -1) {
      var split = line.split('but');
      var correct = split[0]?.match(/(?<=:.*)[1-5]/g);
      var partials = split[1]?.match(/[1-5]/g);
    
      _rowUpdater(row, correct, SCORE.CORRECT);
      _rowUpdater(row, partials, SCORE.PARTIAL);
    
    // Only greens
    } else if(line.indexOf('perfect') > -1) {
      var matches = line.match(/(?<=:.*)[1-5]/g);
      // If it only has the word "perfect" and no numbers, assume it's all greens.
      if (!matches) {
        row.fill(SCORE.CORRECT, 0);
      } else {
        _rowUpdater(row, matches, SCORE.CORRECT);
      }

    // 100% yellows
    } else if(line.indexOf('all the correct letters but in the wrong order') > -1) {
      row.fill(SCORE.PARTIAL, 0);
    }
    return row;
  }).flat();

  // If every single line is invalid, then reject this wordle
  // e.g. single line with only 0s means nothing was matched & not solved
  if (output.every((val) => val === 0)) {
    return [];
  }
   
  return output;
}

function _rowUpdater(row, matches, score) {
  if(!!matches) {
    for (var j=0; j<matches.length; j++) {
      row[matches[j]-1] = score;
    }
  }
  return row;
}

// ****************
// EXPRESS SERVER
// ****************

initServer();
