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

/**
 * TODO: read mentions since communities is not availble via API yet
 * T.get('statuses/mentions_timeline').then(({data}) => {
  console.log(data);
});
*/

function processStream(tweet) {

  var id = tweet.id_str;
  var parentId = tweet.in_reply_to_status_id_str;
  var tweetText = tweet.text;

  // Exit if this is a self-wordle debugging tweet (prevent multi-tweets)
  if(tweetText.indexOf('The above wordle scored') > -1 || 
    tweetText.indexOf('Sorry, something went wrong.') > -1) {
    return;
  }

  var screenName = '@' + tweet.user.screen_name;
  var altText = tweet.extended_entities?.media?.[0]?.description || '';
  var wordleResult = getWordleMatrixFromText(tweetText);

  // Try alt text if there's no wordle result in main text
  if (wordleResult.length === 0) {
    wordleResult = getWordleMatrixFromImageAltText(altText);
  }

  /**
   * Check @ mentioned tweet text & alt text.
   * If there's no wordle, check the parent tweet.
   * If there's no wordle on the parent tweet, bail out.
   */
  const wordleResultPromise = new Promise((resolve, reject) => {
    // If @mention tweet & alt text contains no wordle text, then try checking
    // the parent tweet.
    if(wordleResult.length === 0) {
      // If there's no parent tweet, then bail out.
      if (parentId) {
        T.get('statuses/show/:id', { id: parentId, include_ext_alt_text: true })
          .catch((err) => {
            console.log('parentId request fail: ', err);
            reject({
              name: screenName,
              id: id
            });
          })
          .then(({data}) => {
            var parentAltText = data?.extended_entities?.media?.[0]?.ext_alt_text || '';
            var parentWordleResult = getWordleMatrixFromText(data.text);

            parentWordleResult = parentWordleResult.length > 0 ? 
              parentWordleResult : getWordleMatrixFromImageAltText(parentAltText);

            // Reject if there's no result from the text or the alt text on the parent
            if(parentWordleResult.length === 0) {
              reject({
                name: screenName,
                id: id
              })
            } else {
              resolve({ 
                wordle: parentWordleResult,
                id: id,
                name: screenName
              });
            }
          });
      } else {
        // If there's no parent, then there's nothing else to check. Bail out!
        reject({
          name: screenName,
          id: id
        });
      }
    } else {
      resolve({ 
        wordle: wordleResult, 
        id: id,
        name: screenName
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
  }).catch(function(obj) {
    if (obj.name && obj.id) {
      tweetIfNotRepliedTo({
        status:`${obj.name} Sorry, something went wrong. I wasn't able to decipher the wordle from the requested tweet :(`,
        id: obj.id
      });
    } else {
      console.log('unable to tweet reply failure: ', obj);
    }
  });
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
  return `, solved on row ${solvedRowNum}.`;
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
function getWordleMatrixFromText(text = '') {
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

/** 
T.get('statuses/show/:id', {id: '1488143147368521735', include_ext_alt_text: true}).then(({data}) => {
  var text = data?.extended_entities?.media?.[0]?.ext_alt_text || '';
  console.log(text);
  console.log(getWordleMatrixFromImageAltText(text));
});
*/

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