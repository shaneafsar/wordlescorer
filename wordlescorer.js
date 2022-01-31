const Twit = require('twit');

const WORDLE_BOT_HANDLE = '@ScoreMyWordle';

/**
 * Keep in-memory hash of analyzed tweets.
 */
const REPLY_HASH = {};

const COMPLIMENTS = [
  'Nice work!',
  'Stupendous!',
  'You rock!',
  'Keep it up!',
  'Never give up!',
  '👍👍👍',
  '⭐⭐⭐',
  'Congrats, Wordler!'
];

const SCORE = {
  CORRECT: 2,
  PARTIAL: 1
}

if (process.env.NODE_ENV === "develop") {
  require("dotenv").config();
};

// Pulling keys from another file
var config = require('./config.js');

var T = new Twit(config);
var stream = T.stream('statuses/filter', { track: WORDLE_BOT_HANDLE });
stream.on('tweet', processStream);

function processStream(tweet) {

  var id = tweet.id_str;
  var parentId = tweet.in_reply_to_status_id_str;
  var tweetText = tweet.text;
  var name = '@'+tweet.user.screen_name;

  /**
   * Check @ mentioned tweet. 
   * If there's no wordle, check the parent tweet.
   * If there's no wordle on the parent tweet, bail out.
   */
  const wordleResultPromise = new Promise((resolve, reject) => {
    var wordleResult = getWordleMatrixFromText(tweetText);
    if( wordleResult.length === 0) {
      T.get('statuses/show/:id', { id: parentId })
        .catch((err) => {
          console.log(err);
          reject({
            name: name,
            id: parentId
          });
        })
        .then(({data}) => {
          wordleResult = getWordleMatrixFromText(data.text);
          if(wordleResult.length === 0) {
            reject({
              name: name,
              id: parentId
            })
          } else {
            resolve({ 
              wordle: wordleResult,
              id: parentId,
              name: name
            });
          }
        });
    } else {
      resolve({ 
        wordle: wordleResult, 
        id: id,
        name: name
      });
    }
  });

  wordleResultPromise.then(({wordle, id, name}) => {
    var score = calculateScoreFromWordleMatrix(wordle).finalScore;
    var solvedRow = getSolvedRow(wordle);
    tweetIfNotRepliedTo({ 
      status: `${name} The above wordle scored ${score} out of 360${getSentenceSuffix(solvedRow)} ${getCompliment()}`,
      id: id
    });  
  }).catch(({id, name}) => {
    console.log(id, name);
    tweetIfNotRepliedTo({
      status:`${name} Sorry, something went wrong. I wasn't able to decipher the wordle from the requested tweet :(`,
      id: id
    });
  })
}

/**
 * Returns a compliment.
 * TODO: Consider adjusting to different ones based on score?
 * @returns {string} a compliment :)
 */
function getCompliment() {
  const length = COMPLIMENTS.length;
  return COMPLIMENTS[Math.floor(Math.random() * length)];
}

/**
 * Tweet reply with score/error if it hasn't been recently replied to
 * TODO: store data?
 * @param {Object[]} content
 * @param {string} content[].status - tweet text
 * @param {string} content[].id - reply id
 */
function tweetIfNotRepliedTo(content) {
  var status = content.status; 
  var id = content.id;
  // Tweet if not replied to
  if(!REPLY_HASH[id]) {
    T.post('statuses/update', { 
      status: status, 
      in_reply_to_status_id: id, 
      auto_populate_reply_metadata: true 
    }, (err, reply) => {
      REPLY_HASH[id] = true;
      if (err) {
        console.log(err.message);
      } else {
        console.log(`Tweeted: ${reply.text} to ${reply.in_reply_to_status_id_str}`);
      }
    });
  }
}

/**
 * getSolvedRow
 * @param {Number[]} wordle - score matrix
 * @returns {Number} 0-6
 */
function getSolvedRow(wordle) {
  if (wordle.length === 0 || wordle.length % 5 !== 0) {
    console.log('Invalid wordle!!', wordle);
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
  return `, solved on row ${solvedRow}.`;
}

// const blocks = {'⬛': 0,'⬜': 0,'🟨': 1,'🟦':1,'🟧':2,'🟩': 2};

/**
 * Provides a multiplier for a block based on which row it appeared in.
 * @param {Number} currentIndex 
 * @returns {Number}
 */
function getMultiplier(currentIndex) {
	var multiplier = 1;
  if(currentIndex <= 4) {
    multiplier = 6;
  } else if(currentIndex <= 9) {
    multiplier = 5;
  } else if(currentIndex <= 14) {
    multiplier = 4;
  } else if(currentIndex <= 19) {
    multiplier = 3;
  } else if(currentIndex <= 24) {
    multiplier = 2;
  }
  return multiplier;
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
function getWordleMatrixFromText(text) {
  var wordle = [];
  var codePoint;
  var i=0;
  for(; i < text.length; i++) {
  	codePoint = text.codePointAt(i);
  	if(codePoint === 129000 || codePoint === 128998){
    	wordle.push(SCORE.PARTIAL);
    } else if(codePoint === 129001 || codePoint === 128999){
    	wordle.push(SCORE.CORRECT);
    } else if(codePoint === 11035 || codePoint === 11036){
    	wordle.push(0);
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
  return {finalScore: score+solvedRowBonus };
}