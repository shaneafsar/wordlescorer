import WordleData from '../../js/WordleData.js';

function getTopScoreDB(date?: Date): WordleData {
  return WordleData.init('top-scores', date);
}

export default getTopScoreDB;