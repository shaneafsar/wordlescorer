// @ts-nocheck
import getPercent from  './get-percent.js';

const formatter = new Intl.NumberFormat().format;

// [
//   {
//     total: 698,
//     key: '486',
//     solvedRowCounts: [
//         9,   3, 41, 145,
//       284, 160, 56
//     ]
//   },
//   {
//     total: 287,
//     key: '487',
//     solvedRowCounts: [
//        9,  0,  2, 34,
//       91, 85, 66
//     ]
//   }
// ]

/**
 * @param {number} rowIndex
 * @param {number} solvedRowCount
 * @param {number} total
 */
function formatStatement(rowIndex, solvedRowCount, total) {
  let prefix = rowIndex > 5? 'Not solved:' : `Row ${rowIndex+1}:`;
  return `\n ${prefix} ${formatter(solvedRowCount)} (${getPercent(solvedRowCount, total)})`;
}

/**
 * @typedef {{total: number, key: number, solvedRowCounts: number[]}} WordleScoreStats
 * @param {WordleScoreStats[]} stats - output from getGlobalStats
 * @returns {String[]} - array of tweets to send out
 */
function getFormattedGlobalStats(stats) {
 var tweets = [];
  
 // Ensure that the stats are sorted by total users descending order 
 var sortedStats = [...stats].sort((a, b) => b.total - a.total);
  
 for (var i = 0; i < sortedStats.length; i++) {
  var statsRow = sortedStats[i];
  var total = statsRow.total;
  var sortedRowCounts = statsRow.solvedRowCounts.slice(1);
  // Push not solved to end of array
  sortedRowCounts.push(statsRow.solvedRowCounts[0]);
   

  var statement = `In the last 24 hours for Wordle ${statsRow.key}, I found ${formatter(total)} unique users with the following distribution:`
   
  for (var j = 0; j < sortedRowCounts.length; j++) {
    statement += formatStatement(j, sortedRowCounts[j], total);
  }
   
  tweets.push(statement);
   
  }

  return tweets;
};

export default getFormattedGlobalStats;
