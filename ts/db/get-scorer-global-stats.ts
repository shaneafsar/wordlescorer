import getGlobalStats from './get-global-stats.js';
import getPercent from '../display/get-percent.js';

const formatter = new Intl.NumberFormat().format;

interface GlobalStatsResult {
  wordlePrefix: string;
  aboveTotal: string;
}

interface GetScorerGlobalStatsInput {
  solvedRow: number;
  wordleNumber: number;
  date: Date;
}

async function getScorerGlobalStats(
  { solvedRow, wordleNumber, date }: GetScorerGlobalStatsInput,
  globalScoreDB?: any
): Promise<GlobalStatsResult> {
  const globalStats = await getGlobalStats(date, null, true).catch((err: Error) => {
    console.error(err);
  });

  if (!globalStats) {
    return {
      wordlePrefix: 'wordle',
      aboveTotal: ''
    };
  }

  const final = globalStats.filter(item => item.key + '' === wordleNumber + '');

  if (final.length > 0) {
    const solvedRowCounts = final[0].solvedRowCounts.slice(0);
    solvedRowCounts.push(final[0].solvedRowCounts[0]);

    let aboveTotal = 0;
    if (solvedRow > 0 && solvedRow < 7) {
      let iteratorStart = solvedRow + 1;
      for (let i = iteratorStart; i < solvedRowCounts.length; i++) {
        aboveTotal += solvedRowCounts[i];
      }
    }

    const renderAboveTotal = aboveTotal > 1;

    return {
      wordlePrefix: `Wordle #${wordleNumber}`,
      aboveTotal: renderAboveTotal ? `Solved above ${formatter(aboveTotal)} others so far today!` : ''
    };
  }

  return {
    wordlePrefix: 'wordle',
    aboveTotal: ''
  };
}

export default getScorerGlobalStats;