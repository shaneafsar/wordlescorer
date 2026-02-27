import type { APIContext } from 'astro';

export async function GET({ locals, request }: APIContext) {
  const db = locals.runtime.env.DB;
  const url = new URL(request.url);

  const q = url.searchParams.get('q') || '';
  const wordleNumber = url.searchParams.get('wordleNumber') || '';
  const solvedRow = url.searchParams.get('solvedRow') ?? '';
  const scoreMin = url.searchParams.get('scoreMin') || '';
  const scoreMax = url.searchParams.get('scoreMax') || '';
  const source = url.searchParams.get('source') || '';
  const autoScore = url.searchParams.get('autoScore') ?? '';
  const page = url.searchParams.get('page') || '0';
  const pageSize = url.searchParams.get('pageSize') || '20';

  const pageNum = Math.max(0, parseInt(page, 10) || 0);
  const size = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));
  const offset = pageNum * size;

  const where: string[] = [];
  const params: (string | number)[] = [];

  if (q) {
    where.push('scorer_name LIKE ?');
    params.push(`%${q}%`);
  }
  if (wordleNumber) {
    where.push('wordle_number = ?');
    params.push(parseInt(wordleNumber, 10));
  }
  if (solvedRow !== '') {
    where.push('solved_row = ?');
    params.push(parseInt(solvedRow, 10));
  }
  if (scoreMin) {
    where.push('score >= ?');
    params.push(parseInt(scoreMin, 10));
  }
  if (scoreMax) {
    where.push('score <= ?');
    params.push(parseInt(scoreMax, 10));
  }
  if (source) {
    where.push('source = ?');
    params.push(source);
  }
  if (autoScore !== '') {
    where.push('auto_score = ?');
    params.push(parseInt(autoScore, 10));
  }

  const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

  // Get total count
  const countResult = await db
    .prepare(`SELECT COUNT(*) as total FROM analyzed_posts ${whereClause}`)
    .bind(...params)
    .first<{ total: number }>();
  const total = countResult?.total || 0;

  // Get results
  const results = await db
    .prepare(
      `SELECT id, scorer_name, wordle_number, score, solved_row, is_hard_mode, source, url, auto_score, created_at, date_key
       FROM analyzed_posts ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(...params, size, offset)
    .all();

  // Get facet counts
  const facets: Record<string, any> = {};

  if (!wordleNumber) {
    const wnFacets = await db
      .prepare(
        `SELECT wordle_number as value, COUNT(*) as count FROM analyzed_posts ${whereClause} GROUP BY wordle_number ORDER BY wordle_number DESC LIMIT 20`
      )
      .bind(...params)
      .all();
    facets.wordleNumbers = wnFacets.results;
  }

  if (solvedRow === '') {
    const srFacets = await db
      .prepare(
        `SELECT solved_row as value, COUNT(*) as count FROM analyzed_posts ${whereClause} GROUP BY solved_row ORDER BY solved_row`
      )
      .bind(...params)
      .all();
    facets.solvedRows = srFacets.results;
  }

  return new Response(
    JSON.stringify({
      hits: results.results.map((r: any) => ({
        id: r.id,
        scorerName: r.scorer_name,
        wordleNumber: r.wordle_number,
        score: r.score,
        solvedRow: r.solved_row,
        isHardMode: !!r.is_hard_mode,
        source: r.source,
        url: r.url,
        autoScore: !!r.auto_score,
        date_timestamp: Math.floor(r.created_at / 1000),
      })),
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size),
      facets,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    }
  );
}
