import getPercent from './get-percent';

const formatter = new Intl.NumberFormat().format;

interface WordleScoreStats {
  total: number;
  key: number;
  solvedRowCounts: number[];
}

function formatStatement(rowIndex: number, solvedRowCount: number, total: number): string {
  const prefix = rowIndex > 5 ? 'Not solved:' : `Row ${rowIndex + 1}:`;
  return `\n ${prefix} ${formatter(solvedRowCount)} (${getPercent(solvedRowCount, total)})`;
}

function getFormattedGlobalStats(stats: WordleScoreStats[]): string[] {
  const tweets: string[] = [];

  const sortedStats = [...stats].sort((a, b) => b.total - a.total);

  for (let i = 0; i < sortedStats.length; i++) {
    const statsRow = sortedStats[i];
    const total = statsRow.total;
    const sortedRowCounts = statsRow.solvedRowCounts.slice(1);
    sortedRowCounts.push(statsRow.solvedRowCounts[0]);

    let statement = `In the last 24 hours for #Wordle ${statsRow.key}, I found ${formatter(total)} unique users with the following distribution:`;

    for (let j = 0; j < sortedRowCounts.length; j++) {
      statement += formatStatement(j, sortedRowCounts[j], total);
    }

    tweets.push(statement);
  }

  return tweets;
}

export default getFormattedGlobalStats;
