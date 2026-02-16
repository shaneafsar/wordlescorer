import getGlobalScoreDB from './get-global-score-DB.js';

interface WordleScoreStats {
  total: number;
  key: number;
  solvedRowCounts: number[];
}

interface ScorerData {
  wordleNumber: number;
  wordleScore: number;
  solvedRow: number;
  tweetId: string;
  userId: string;
  screenName: string;
  datetime: number;
}

/**
 * @param date datetime of global stats to pull 
 * @param globalScoreDB instance of globalScoreDB
 * @param forceMongo force mongo to be used
 * @returns Returns array of wordle stats
 */
async function getGlobalStats(
  date: Date, 
  globalScoreDB?: any, 
  forceMongo: boolean = true
): Promise<WordleScoreStats[]> {
  const GlobalScoreStatsDB = globalScoreDB || getGlobalScoreDB(date);

  let data = await GlobalScoreStatsDB.read(null, date, forceMongo).catch((err: Error) => {
    console.error(err);
  });

  const scorerList: ScorerData[] = Array.isArray(data) ? data : Object.values(data || {});
  const wordleScores: Record<string, WordleScoreStats> = {};
  
  scorerList.forEach(item => {
    const keyStr = item.wordleNumber + '';
    const key = item.wordleNumber;
    const solvedRow = item.solvedRow;
    
    // Only allow valid wordles through
    if (solvedRow < 7) {
      if (wordleScores[keyStr]) {
        wordleScores[keyStr].total++;
      } else {
        wordleScores[keyStr] = { 
          total: 1,
          key: key,
          solvedRowCounts: [0, 0, 0, 0, 0, 0, 0]
        };
      }
      wordleScores[keyStr].solvedRowCounts[solvedRow]++;
    }
  });

  // Sort by most popular
  const sortedWordleStats = Object.values(wordleScores).sort((a, b) => b.total - a.total);

  // Sort by wordle key/number
  return sortedWordleStats.slice(0, 2).sort((a, b) => b.key - a.key);
}

export default getGlobalStats;