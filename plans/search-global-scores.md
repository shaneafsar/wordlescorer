# Switch search to query global_scores

## Goal
Show all players in search results (not just followers) by querying `global_scores` instead of `analyzed_posts`.

## Approach
- Query `global_scores` as the base table
- LEFT JOIN `analyzed_posts` on `url` to pull in `auto_score`
- Treat NULL `auto_score` (non-follower rows) as auto/growth (1)

## Column mapping
| search field | current (analyzed_posts) | new (global_scores) |
|---|---|---|
| scorer_name | scorer_name | screen_name |
| wordle_number | wordle_number | wordle_number |
| score | score | wordle_score |
| solved_row | solved_row | solved_row |
| is_hard_mode | is_hard_mode | is_hard_mode |
| source | source | source |
| url | url | url |
| auto_score | auto_score | LEFT JOIN analyzed_posts → COALESCE(a.auto_score, 1) |
| created_at | created_at | created_at |
| date_key | date_key | date_key |

## Example query
```sql
SELECT g.id, g.screen_name as scorer_name, g.wordle_number, g.wordle_score as score,
       g.solved_row, g.is_hard_mode, g.source, g.url, g.created_at, g.date_key,
       COALESCE(a.auto_score, 1) as auto_score
FROM global_scores g
LEFT JOIN analyzed_posts a ON g.url = a.url
```

## Files to change
- `cloudflare/web/src/pages/api/search.ts` — update all queries to use global_scores + LEFT JOIN

## Considerations
- Need index on `global_scores(screen_name)` for name search (currently only indexed on user_key and date_key)
- Need index on `global_scores(wordle_number)` for wordle number filter
- Facet queries also need updating to use global_scores
- `analyzed_posts` range query for wordle_number clamping (line 94-97) should switch to global_scores
