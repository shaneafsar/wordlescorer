// @ts-nocheck
import getGlobalScoreDB from './get-global-score-DB.js';

/**
 * @typedef {{total: number, key: number, solvedRowCounts: number[]}} WordleScoreStats
 * @param {Date} date datetime of global stats to pull 
 * @param {WordleData} [globalScoreDB] instance of globalScoreDB
 * @param {Boolean} [forceMongo] force mongo to be used
 * @returns {Promise<WordleScoreStats[]>} Returns array of wordle stats
 */
async function getGlobalStats(date, globalScoreDB, forceMongo = true) {
  const GlobalScoreStatsDB =  globalScoreDB || getGlobalScoreDB(date);
// userId: {
//     "wordleNumber": 486,
//     "wordleScore": 138,
//     "solvedRow": 4,
//     "tweetId": "1582402486090215425",
//     "userId": "15167084",
//     "screenName": "@TEST",
//     "datetime": 1666109132149
//   },
  //console.log('*** db.getGlobalStats *** ', date);
  let data = await GlobalScoreStatsDB.read(null, date, forceMongo).catch((err) => {
    console.error(err);
  });

  //If it's an array, then we're pulling from mongo
  const scorerList = Array.isArray(data) ? data : Object.values(data);
  const wordleScores = {};
  
  scorerList.forEach(item => {
    var key = item.wordleNumber+'';
    var solvedRow = item.solvedRow;
    
    //Only allow valid wordles through
    if(solvedRow < 7) {
      if (wordleScores[key]) {
        wordleScores[key].total++;
      } else {
        wordleScores[key] = { 
          total: 1,
          key: key,
          solvedRowCounts: [0, 0, 0, 0, 0, 0, 0]
        };
      }
      wordleScores[key].solvedRowCounts[solvedRow]++;
    }
  });

  // Sort by most popular
  const sortedWordleStats = Object.values(wordleScores).sort((a, b) => b.total-a.total);

  // Sort by wordle key/number
  return sortedWordleStats.slice(0, 2).sort((a, b) => b.key-a.key);
}

export default getGlobalStats;