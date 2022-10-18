import Twit from 'twit';
import dotenv  from 'dotenv';
import WordleData from './WordleData.js';
import getMultiplier from './utils/get-multiplier.js';
import checkIsSameDay from './utils/is-same-day.js';
import getWordleNumberFromText from './utils/get-wordle-number-from-text.js';
import getGlobalStats from './utils/get-global-stats.js';
import getFormattedGlobalStats from './utils/get-formatted-global-stats.js';
import getGlobalScoreDB from './utils/get-global-score-DB.js';
import { SCORE, CODEPOINT_SCORE } from './const/SCORE-CONST.js';
import COMPLIMENTS from './const/COMPLIMENTS.js';
import { WORDLE_BOT_ID, WORDLE_BOT_HANDLE } from './const/WORDLE-BOT.js';
import logger from './logger.js';
import app from "./app.js";
import * as debug$0 from "debug";
import http from "http";

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
const LastMentionDB = new WordleData('last-mention');
const UserGrowthDB = new WordleData('user-growth');

const PROCESSING = {};


var T = new Twit(TWIT_CONFIG);

const REPLY_HASH = await AnalyzedTweetsDB.read();
const LAST_MENTION = await LastMentionDB.read();
const USER_GROWTH_HASH = await UserGrowthDB.read();
var FINAL_SCORE_TIMEOUT = setDailyTopScoreTimeout(tweetDailyTopScore);
var FINAL_GLOBAL_STATS_TIMEOUT = setDailyTopScoreTimeout(tweetGlobalStats);


var stream = T.stream('statuses/filter', { track: WORDLE_BOT_HANDLE });
stream.on('tweet', processTweet);

console.log(getFormattedGlobalStats(await getGlobalStats(new Date())));

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
      }

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
      console.log(`no more mentions as of ${new Date().toUTCString()}`);
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

async function getTopScorerInfo(date) {
  const TopScoreDB = getTopScoreDB(date);
  /**
   * {
   *   userid: 
   *    {
   *      name
   *      score
   *      solvedRow
   *      datetime
   *    }
   * }
   */
  let data = await TopScoreDB.read();
  const scorerList = Object.values(data);
  /**
   * Compare by score, then solved row, then date
   */
  scorerList.sort(function(a,b) {
    if (a.score === b.score) {
      if(a.solvedRow === b.solvedRow) {
        return a.datetime - b.datetime;
      }
      return a.solvedRow - b.solvedRow;
    } else if(a.score > b.score) {
        return -1;
    } else if(a.score < b.score) {
        return 1;
    }
   });
  return scorerList?.[0] || null;
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
    finalStatus = `${scorer.name}! They scored ${scorer.score} points and solved it on row ${scorer.solvedRow}! ${getCompliment()}`;

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

function processTweet(tweet, isGrowthTweet) {
  const id = tweet.id_str;
  const parentId = tweet.in_reply_to_status_id_str;
  const tweetText = tweet.text;
  const userId = tweet.user.id_str;
  const createdAt = new Date(tweet.created_at);
  const createdAtMs = createdAt.getTime();
  const isSameDay = checkIsSameDay(createdAt);
  
  UserGrowthDB.write(userId, { lastCheckTime: Date.now()});
  /**
   * Bail early if this tweet has been processed or is 
   * processing.
   */
  if(REPLY_HASH[id] || PROCESSING[id]) {
    return;
  }

  PROCESSING[id] = true;

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
        if(REPLY_HASH[parentId] || PROCESSING[parentId]) {
          reject({
            name: screenName,
            id: id,
            parentId: parentId,
            message: 'already processed parentId'
          });
          return;
        }

        
        T.get('statuses/show/:id', { id: parentId, include_ext_alt_text: true })
          .catch((err) => {
            console.log('parentId request fail: ', err);
            reject({
              name: screenName,
              id: id,
              parentId: parentId,
              message: 'parentId request fail'
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
            var parentName = '@' + data.user.screen_name;
            var parentTweetId = parentId;

            // BUG: Need to refactor to include parent tweet context

            // Reject if there's no result from the text or the alt text on the parent
            if(parentWordleResult.length === 0) {
              reject({
                name: screenName,
                id: id
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
                scorerTweetId: parentTweetId,
                datetime: createdAtMs
              });
            }
          });
      } else {
        // If there's no parent or it's a growth tweet, then there's nothing else to check. Bail out!
        reject({
          name: screenName,
          id: id
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
        scorerTweetId: id,
        datetime: createdAtMs
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
    scorerTweetId, 
    datetime}) => {
    const score = calculateScoreFromWordleMatrix(wordle).finalScore;
    const solvedRow = getSolvedRow(wordle);

    /**
     * Add to today's scores if tweet happened today
     */
    if(isSameDay) {
      updateTopScores({ 
        name: scorerName, 
        userId: scorerUserId,
        wordleNum: wordleNumStr,
        score, 
        solvedRow, 
        datetime
      });
    }

    tweetIfNotRepliedTo({
      name: name,
      score: score,
      solvedRow: solvedRow, 
      status: `${name} The wordle scored ${score} out of 360${getSentenceSuffix(solvedRow)} ${getCompliment(isGrowthTweet)}`,
      id: id
    });  
  }).catch(function(obj) {
    if (obj.name && obj.id) {
      AnalyzedTweetsDB.write(obj.id, {
        name: obj.name
      });

      /**tweetIfNotRepliedTo({
        status:`${obj.name} Sorry, something went wrong. I wasn't able to decipher the wordle from the requested tweet :(`,
        id: obj.id
      });*/
    } else {
      logger.error((new Date()).toUTCString(),'unable to tweet reply failure: ', obj);
      console.log('unable to tweet reply failure: ', obj);
    }
  });
}

function getTopScoreDB(date) {
  if(!date) {
    date = new Date();
  }
  return new WordleData(`top-scores-${date.getUTCMonth()}-${date.getUTCDate()}-${date.getUTCFullYear()}`, 'top-scores');
}

function updateGlobalScores({
    wordleNumber,
    wordleScore,
    solvedRow,
    tweetId,
    userId,
    screenName,
  }) {
  const GlobalScoresDB = getGlobalScoreDB();
  GlobalScoresDB.write(userId, {
    wordleNumber,
    wordleScore,
    solvedRow,
    tweetId,
    userId,
    screenName,
  });
}

function updateTopScores({name, score, solvedRow, userId, datetime}) {
  const TopScoresDB = getTopScoreDB();
  /**
   * Only allow one score per user
   */
  TopScoresDB.write(userId, {
    name,
    score,
    solvedRow,
    datetime
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
 * @param {string} content[].name - account name
 * @param {number} content[].score - calculated score
 * @param {number} content[].solvedRow
 */
function tweetIfNotRepliedTo({status, id, name, score, solvedRow}) {
  if(!REPLY_HASH[id]) {
    T.post('statuses/update', { 
      status: status, 
      in_reply_to_status_id: id, 
      auto_populate_reply_metadata: true 
    }, (err, reply) => {
      REPLY_HASH[id] = true;
        if (err) {
          console.log(err.message);
          /**
           * Hack for Twitter Communities (no API yet)
           */
          if(err.message === 'Reply to a community tweet must also be a community tweet') {
            console.log('Attempting to quote tweet');
            T.post('statuses/update', { 
              status: status, 
              attachment_url: `https://twitter.com/${name.substring(1)}/status/${id}`
            }, (err, data) => {
              if(err) {
                console.log('failed to quote tweet ', err);
                logger.error((new Date()).toUTCString(),' | failed to quote tweet ', err);
              }
            });
        }
        logger.error((new Date()).toUTCString(),' | reply error: ', id, name, score, solvedRow, err);
      } else {
        console.log(`Tweeted: ${reply.text} to ${reply.in_reply_to_status_id_str}`);
      }
      AnalyzedTweetsDB.write(id, {
        name: name,
        score: score,
        solvedRow: solvedRow,
      });
    });
  }
}

function isValidWordle(wordle) {
  if (wordle.length === 0 || wordle.length % 5 !== 0) {
    console.log('Invalid wordle!!', wordle);
    return false;
  }
  return true;
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
 * Convert text to a flattened array representing scores for each square.
 * @param {String} text - input text to conver to wordle score array
 * @returns {Number[]}
 */
function getWordleMatrixFromText(text = '') {
  var wordle = [];
  var codePoint, codePointScore;
  var i = 0;
  for(; i < text.length; i++) {
  	codePoint = text.codePointAt(i);
    codePointScore = CODEPOINT_SCORE.get(codePoint);
    if(typeof codePointScore === 'number') {
      wordle.push(codePointScore);
    }
  }
  return wordle;
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
  var lines = text.split('\n');
  return lines.map((line) => {
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
 
var debug = debug$0.default('static2:server');
/**
 * Get port from environment and store in Express.
 */
var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);
/**
 * Create HTTP server.
 */
var server = http.createServer(app);
/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port);
server.on('error', onError);
server.on('listening', onListening);
/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
    var port = parseInt(val, 10);
    if (isNaN(port)) {
        // named pipe
        return val;
    }
    if (port >= 0) {
        // port number
        return port;
    }
    return false;
}
/**
 * Event listener for HTTP server "error" event.
 */
function onError(error) {
    if (error.syscall !== 'listen') {
        throw error;
    }
    var bind = typeof port === 'string'
        ? 'Pipe ' + port
        : 'Port ' + port;
    // handle specific listen errors with friendly messages
    switch (error.code) {
        case 'EACCES':
            console.error(bind + ' requires elevated privileges');
            process.exit(1);
            break;
        case 'EADDRINUSE':
            console.error(bind + ' is already in use');
            process.exit(1);
            break;
        default:
            throw error;
    }
}
/**
 * Event listener for HTTP server "listening" event.
 */
function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr.port;
    debug('Listening on ' + bind);
}