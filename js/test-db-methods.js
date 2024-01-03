import getGlobalStats from '../js/db/get-global-stats.js';
import getGlobalScoreDB from '../js/db/get-global-score-DB.js';
import WordleData from '../js/WordleData.js';


async function main() {
  const stats = await getGlobalStats(new Date());
  console.log(stats);
}

async function updateRecords() {
  //const db = getGlobalScoreDB();
  const db = new WordleData('analyzed');
  //await db.tempUpdate();
}

//updateRecords();

main();