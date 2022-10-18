import WordleData from '../WordleData.js';

function getGlobalScoreDB(date) {
  if(!date) {
    date = new Date();
  }
  return new WordleData(`global-scores-${date.getUTCMonth()}-${date.getUTCDate()}-${date.getUTCFullYear()}`, 'global-scores');
}

export default getGlobalScoreDB;