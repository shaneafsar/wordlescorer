import WordleData from '../WordleData.js';

function getTopScoreDB(date) {
  if(!date) {
    date = new Date();
  }
  return new WordleData(`top-scores-${date.getUTCMonth()}-${date.getUTCDate()}-${date.getUTCFullYear()}`, 'top-scores');
}

export default getTopScoreDB;