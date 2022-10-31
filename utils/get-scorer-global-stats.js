import getGlobalStats from './get-global-stats.js';
import getPercent from './get-percent.js';

const formatter = new Intl.NumberFormat().format;

async function getScorerGlobalStats({solvedRow, wordleNumber, date}) {
  console.log(`*** getting scorers global stats... ***`);
  
 const globalStats = await getGlobalStats(date).catch((err)   => {
    console.error(err);
  });
  
  var final = globalStats.filter(item => item.key+'' === wordleNumber + '');
  
  if(final.length > 0) {
  
    const solvedRowCounts =  final[0].solvedRowCounts.slice(0);
    solvedRowCounts.push(final[0].solvedRowCounts[0]);
    const globalStatsTotal = final[0].total;
  
    let aboveTotal = 0;
    if (solvedRow > 0 && solvedRow < 7) {
      let iteratorStart = solvedRow + 1;
      for(var i = iteratorStart; i < solvedRowCounts.length; i++) {
        aboveTotal += solvedRowCounts[i];
      }
    }
    
    //let percentage = getPercent(scorer.aboveTotal, globalStatsTotal);
    const renderAboveTotal = aboveTotal > 1;
    aboveTotal = formatter(aboveTotal);
    
    return {
      wordlePrefix: `Wordle #${wordleNumber}`,
      aboveTotal: renderAboveTotal ? `Solved above ${aboveTotal} others so far today!` : ''
    };
  }
  return {
    wordlePrefix: 'wordle',
    aboveTotal: ''
  };
}

export default getScorerGlobalStats;