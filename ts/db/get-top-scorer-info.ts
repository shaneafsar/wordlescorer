import getGlobalStats from './get-global-stats.js';
import getTopScoreDB from './get-top-score-DB.js';
import getPercent from '../display/get-percent.js';

const formatter = new Intl.NumberFormat().format;

interface ScorerInfo {
  name: string;
  screenName?: string;
  scorerName?: string;
  score: number;
  solvedRow: number;
  datetime: number;
  wordleNumber: number;
  userid: string;
  aboveTotal?: number | string;
  percentage?: string;
}

async function getTopScorerInfo(date: Date, forceMongo: boolean = true): Promise<ScorerInfo | null> {
  const TopScoreDB = getTopScoreDB(date);
  const globalStats = await getGlobalStats(date, null, forceMongo).catch((err: Error) => {
    console.error(err);
  });

  let data = await TopScoreDB.read(null, date, forceMongo).catch((err: Error) => {
    console.error(err);
  });

  if (!data || !globalStats) {
    return null;
  }

  let scorerList: ScorerInfo[] = Array.isArray(data) ? data : Object.values(data);

  // Select the most likely wordle that we care about today, filter to those people
  if (globalStats.length > 1) {
    let globalStat = globalStats?.[0].total < globalStats?.[1].total ? globalStats[1] : globalStats[0];

    // filter scorerList to items with wordleNumber that have globalStat.key
    scorerList = scorerList.filter((scorer) => {
      return String(globalStat.key) === String(scorer.wordleNumber);
    });

    const solvedRowCounts = globalStat.solvedRowCounts.slice(0);
    solvedRowCounts.push(globalStat.solvedRowCounts[0]);
    const globalStatsTotal = globalStat.total;

    scorerList.forEach(scorer => {
      scorer.aboveTotal = 0;
      // If it's not solved, the row is 0
      if (scorer.solvedRow !== 0) {
        let iteratorStart = scorer.solvedRow + 1;
        for (let i = iteratorStart; i < solvedRowCounts.length; i++) {
          scorer.aboveTotal += solvedRowCounts[i];
        }
      }
      scorer.percentage = getPercent(scorer.aboveTotal as number, globalStatsTotal);
      scorer.aboveTotal = formatter(scorer.aboveTotal as number);
    });
  }

  // Compare by score, then solved row, then date
  scorerList.sort(function(a, b) {
    if (a.score === b.score) {
      if (a.solvedRow === b.solvedRow) {
        return a.datetime - b.datetime;
      }
      return a.solvedRow - b.solvedRow;
    } else if (a.score > b.score) {
      return -1;
    } else if (a.score < b.score) {
      return 1;
    }
    return 0;
  });

  return scorerList?.[0] || null;
}

export default getTopScorerInfo;