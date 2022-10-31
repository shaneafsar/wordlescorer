import getGlobalScoreDB from './get-global-score-DB.js';

async function getGlobalStats(date) {
  const GlobalScoreStatsDB = getGlobalScoreDB(date);
// userId: {
//     "wordleNumber": 486,
//     "wordleScore": 138,
//     "solvedRow": 4,
//     "tweetId": "1582402486090215425",
//     "userId": "15167084",
//     "screenName": "@TEST",
//     "datetime": 1666109132149
//   },
  let data = await GlobalScoreStatsDB.read().catch((err) => {
    console.error(err);
  });
  const scorerList = Object.values(data);
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