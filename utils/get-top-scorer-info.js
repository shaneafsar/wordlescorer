import getGlobalStats from './get-global-stats.js';
import getTopScoreDB from './get-top-score-DB.js';
import getPercent from './get-percent.js';

const formatter = new Intl.NumberFormat().format;

async function getTopScorerInfo(date) {
  const TopScoreDB = getTopScoreDB(date);
  const globalStats = await getGlobalStats(date);
  /**
   * {
   *   userid: 
   *    {
   *      name
   *      score
   *      solvedRow
   *      datetime
   *      wordleNumber
   *    }
   * }
   */
  let data = await TopScoreDB.read();
  let scorerList = Object.values(data);

  // Select the most likely wordle that we care about today, filter to those people
  if (globalStats.length > 1 && globalStats?.[1].key && globalStats?.[0].total < globalStats?.[1].total) {
    // filter scorerList to items with wordleNumber that have globalStats[1].key
    scorerList = scorerList.filter((scorer) => {
      return globalStats[1].key === scorer.wordleNumber+'';
    });

    const solvedRowCounts =  globalStats[1].solvedRowCounts.slice(0);
    solvedRowCounts.push(globalStats[1].solvedRowCounts[0]);
    const globalStatsTotal = globalStats[1].total;

    scorerList.forEach(scorer => {
      scorer.aboveTotal = 0;
      var iteratorStart = scorer.solvedRow + 1;
      for(var i = iteratorStart; i < solvedRowCounts.length; i++) {
        scorer.aboveTotal += solvedRowCounts[i];
      }
      scorer.percentage = getPercent(scorer.aboveTotal, globalStatsTotal);
      scorer.aboveTotal = formatter(scorer.aboveTotal);
    });
  }
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

export default getTopScorerInfo;