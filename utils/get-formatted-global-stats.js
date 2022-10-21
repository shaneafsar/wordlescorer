import getPercent from  './get-percent.js';

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

function getFormattedGlobalStats(stats) {
 var tweets = [];
 var formatter = new Intl.NumberFormat().format;
 for (var i = 0; i < stats.length; i++) {
  var statsRow = stats[i];
  var total = statsRow.total;
  var statement = `In the last 24 hours for Wordle ${statsRow.key}, I found ${formatter(total)} unique users with the following solution distribution:
  Row 1: ${formatter(statsRow.solvedRowCounts[1])} (${getPercent(statsRow.solvedRowCounts[1], total)})
  Row 2: ${formatter(statsRow.solvedRowCounts[2])} (${getPercent(statsRow.solvedRowCounts[2], total)})
  Row 3: ${formatter(statsRow.solvedRowCounts[3])} (${getPercent(statsRow.solvedRowCounts[3], total)})
  Row 4: ${formatter(statsRow.solvedRowCounts[4])} (${getPercent(statsRow.solvedRowCounts[4], total)})
  Row 5: ${formatter(statsRow.solvedRowCounts[5])} (${getPercent(statsRow.solvedRowCounts[5], total)})
  Row 6: ${formatter(statsRow.solvedRowCounts[6])} (${getPercent(statsRow.solvedRowCounts[6], total)})
  Not solved: ${formatter(statsRow.solvedRowCounts[0])} (${getPercent(statsRow.solvedRowCounts[0], total)})`;
  tweets.push(statement);
 }
  if(tweets.length > 0) {
    return [tweets[0]];
  }
  return tweets;
};

export default getFormattedGlobalStats;
