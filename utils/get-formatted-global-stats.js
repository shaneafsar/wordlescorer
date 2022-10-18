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
 for (var i = 0; i < stats.length; i++) {
  var statsRow = stats[i];
  var total = statsRow.total;
  var statement = `For Wordle ${statsRow.key} -- So far, I found ${total} unique users with the following solution distribution:
  Row 1: ${statsRow.solvedRowCounts[1]}
  Row 2: ${statsRow.solvedRowCounts[2]}
  Row 3: ${statsRow.solvedRowCounts[3]}
  Row 4: ${statsRow.solvedRowCounts[4]}
  Row 5: ${statsRow.solvedRowCounts[5]}
  Row 6: ${statsRow.solvedRowCounts[6]}
  Not solved: ${statsRow.solvedRowCounts[0]}`;
  tweets.push(statement);
 }
  return tweets;
};

export default getFormattedGlobalStats;
