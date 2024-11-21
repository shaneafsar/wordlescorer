// @ts-nocheck
import getGlobalStats from './get-global-stats.js';
import getPercent from '../display/get-percent.js';

const formatter = new Intl.NumberFormat().format;

/**
 * Calculated result from wordle matrix
 * @typedef {Object} GlobalStatsResult
 * @property {string} wordlePrefix
 * @property {string} aboveTotal
 */

/**
 * Provides formatted text to inform how a particular game ranks based on solved row
 * @param {Object} input
 * @param {number} input.solvedRow 
 * @param {number} input.wordleNumber 
 * @param {Date} input.date
 * @param {WordleData} [globalScoreDB] instance of globalScoreBD
 * @returns {Promise<GlobalStatsResult>}
 */
async function getScorerGlobalStats({ solvedRow, wordleNumber, date }, globalScoreDB) {
  console.log(`*** getting scorers global stats... ***`);
  
  const globalStats = await getGlobalStats(date, null, true).catch((err)   => {
    console.error(err);
  });
  //console.log(JSON.stringify(globalStats, null, 2));
  var final = globalStats.filter(item => item.key+'' === wordleNumber + '');
  
  if(final.length > 0) {
  
    const solvedRowCounts =  final[0].solvedRowCounts.slice(0);
    solvedRowCounts.push(final[0].solvedRowCounts[0]);
    //const globalStatsTotal = final[0].total;
  
    let aboveTotal = 0;
    if (solvedRow > 0 && solvedRow < 7) {
      let iteratorStart = solvedRow + 1;
      for(var i = iteratorStart; i < solvedRowCounts.length; i++) {
        aboveTotal += solvedRowCounts[i];
      }
    }
    
    //let percentage = getPercent(scorer.aboveTotal, globalStatsTotal);
    const renderAboveTotal = aboveTotal > 1;
    
    return {
      wordlePrefix: `Wordle #${wordleNumber}`,
      aboveTotal: renderAboveTotal ? `Solved above ${formatter(aboveTotal)} others so far today!` : ''
    };
  }
  return {
    wordlePrefix: 'wordle',
    aboveTotal: ''
  };
}

export default getScorerGlobalStats;