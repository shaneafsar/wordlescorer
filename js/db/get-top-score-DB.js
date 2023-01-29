import WordleData from '../WordleData.js';

/**
 * @param {Date | undefined} [date]
 */
function getTopScoreDB(date) {
  return WordleData.init('top-scores', date);
}

export default getTopScoreDB;