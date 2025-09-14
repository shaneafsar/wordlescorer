import getGlobalStats from '../ts/db/get-global-stats.js';
import getGlobalScoreDB from '../ts/db/get-global-score-DB.js';
import WordleData from './WordleData.js';


async function main() {
  const stats = await getGlobalStats(new Date());
  console.log(stats);
}

async function updateRecords() {
  const db = getGlobalScoreDB();
  //const db = new WordleData('analyzed');
  //await db.tempUpdate();
}

//updateRecords();

main();