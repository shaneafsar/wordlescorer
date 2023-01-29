import WordleData from '../WordleData.js';

/**
 * 
 * @param {Date} [date] 
 * @returns {WordleData}
 */
function getGlobalScoreDB(date) {
  return WordleData.init('global-scores', date);
}

export default getGlobalScoreDB;