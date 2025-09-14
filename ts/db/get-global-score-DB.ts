import WordleData from '../../js/WordleData.js';

/**
 * 
 * @param {Date} [date] 
 * @returns {WordleData}
 */
function getGlobalScoreDB(date?: Date): WordleData {
  return WordleData.init('global-scores', date);
}

export default getGlobalScoreDB;