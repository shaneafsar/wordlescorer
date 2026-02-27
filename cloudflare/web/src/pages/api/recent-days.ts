import type { APIContext } from 'astro';

function todayDateKey(): string {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

function getPercent(num: number, total: number): string {
  if (num === 0) return '0%';
  const pct = (num / total) * 100;
  if (pct > 0 && pct < 1) return '<1%';
  return Math.round(pct) + '%';
}

export async function GET({ locals }: APIContext) {
  const db = locals.runtime.env.DB;
  const today = todayDateKey();

  // Get last 7 completed days (excluding today)
  const daysResult = await db
    .prepare('SELECT DISTINCT date_key FROM global_scores WHERE date_key < ? ORDER BY date_key DESC LIMIT 7')
    .bind(today)
    .all();

  const days = await Promise.all(
    daysResult.results.map(async (dayRow: any) => {
      const dateKey = dayRow.date_key;

      // Row distribution
      const rowsResult = await db
        .prepare('SELECT solved_row, COUNT(*) as cnt FROM global_scores WHERE date_key = ? GROUP BY solved_row')
        .bind(dateKey)
        .all();

      const solvedRowCounts = [0, 0, 0, 0, 0, 0, 0];
      let totalPlayers = 0;
      for (const r of rowsResult.results as any[]) {
        if (r.solved_row >= 0 && r.solved_row <= 6) {
          solvedRowCounts[r.solved_row] = r.cnt;
        }
        totalPlayers += r.cnt;
      }

      const solvedRowPercents = solvedRowCounts.map((c) => getPercent(c, totalPlayers));

      // Most common wordle number
      const wnRow = await db
        .prepare(
          'SELECT wordle_number, COUNT(*) as cnt FROM global_scores WHERE date_key = ? GROUP BY wordle_number ORDER BY cnt DESC LIMIT 1'
        )
        .bind(dateKey)
        .first<{ wordle_number: number }>();
      const wordleNumber = wnRow?.wordle_number ?? null;

      // Winners: all top_scores sharing the max score for this date
      const winnersResult = await db
        .prepare(
          `SELECT screen_name, score, solved_row, source, url FROM top_scores
           WHERE date_key = ? AND score = (SELECT MAX(score) FROM top_scores WHERE date_key = ?)
           ORDER BY created_at ASC`
        )
        .bind(dateKey, dateKey)
        .all();

      const winners = winnersResult.results.map((w: any) => ({
        screenName: w.screen_name,
        score: w.score,
        solvedRow: w.solved_row,
        source: w.source,
        url: w.url,
      }));

      return {
        dateKey,
        wordleNumber,
        totalPlayers,
        solvedRowCounts,
        solvedRowPercents,
        winners,
      };
    })
  );

  return new Response(JSON.stringify({ days }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
