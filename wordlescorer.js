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
  //var name = tweet.user.screen_name;

  /**
   * Check @ mentioned tweet. 
   * If there's no wordle, check the parent tweet.
   * If there's no wordle on the parent tweet, bail out.
   */
  const wordleResultPromise = new Promise((resolve, reject) => {
    var wordleResult = getWordleMatrixFromText(tweetText);
    if( wordleResult.length === 0) {
      T.get('statuses/show/:id', 
        { 
          id: parentId
        }, 
        (err, data) => {
          if(err) {
            reject();
          } else {
            resolve({ 
              wordle: getWordleMatrixFromText(data.text),
              id: parentId
            });
          }
        }
      );
    } else {
      resolve({ 
        wordle: wordleResult, 
        id: id
      });
    }
  });

  wordleResultPromise.then(({wordle, id}) => {
    var score = calculateScoreFromWordleMatrix(wordle).finalScore;
    var solvedRow = wordle.length / 5;
    tweetIfNotRepliedTo(`The above wordle scored ${score} out of 360, solved on row ${solvedRow}. ${getCompliment()}`, id);  
  }).catch((err) => {
    // Tweet if not replied to
    console.log(err);
    tweetIfNotRepliedTo(`Sorry, something went wrong. I wasn't able to decipher the wordle from the requested tweet :(`, id);
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

function tweetIfNotRepliedTo(status, id) {
  // Tweet if not replied to
  console.log(REPLY_HASH);
  if(!REPLY_HASH[id]) {
    T.post('statuses/update', { status: status, in_reply_to_status_id: id }, (err, reply) => {
      REPLY_HASH[id] = true;
      if (err) {
        console.log(err.message);
      } else {
        console.log(`Tweeted: ${reply.text}`);
      }
    });
  }
}

// const blocks = {'⬛': 0,'⬜': 0,'🟨': 1,'🟦':1,'🟧':2,'🟩': 2};

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
function getSolvedRowBonus(solvedRow) {
	var bonus = 0;
  var blocksPerRow = 5;
  var solvedBlockValue = 2;
  var i = solvedRow;
  for(; i<=5; i++) {
  	bonus += solvedBlockValue * blocksPerRow * getMultiplier((solvedRow*5)-1)
  }
  return bonus;
}

/**
 * Convert text to an array representing scores for each square
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
    	wordle.push(1);
    } else if(codePoint === 129001 || codePoint === 128999){
    	wordle.push(2);
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
  var solvedRowBonus = getSolvedRowBonus(wordle.length / 5);
  var score = wordle.map((element, index) => {
    return element*getMultiplier(index);
  }).reduce((previous, current) => {
  	return previous+current;
  });
  return {finalScore: score+solvedRowBonus };
}