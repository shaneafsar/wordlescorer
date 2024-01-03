import getGlobalStats from '../js/db/get-global-stats.js';


async function main() {
  const stats = await getGlobalStats(new Date());
  console.log(stats);
}

main();