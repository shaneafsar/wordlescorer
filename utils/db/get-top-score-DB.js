import WordleData from '../../WordleData.js';

function getTopScoreDB(date) {
  return WordleData.init('top-scores', date);
}

export default getTopScoreDB;