# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a **Wordle scoring bot** that runs on Mastodon and Bluesky, deployed entirely on Cloudflare. The repo contains two subprojects:

- `cloudflare/worker/` — Cloudflare Worker (bot logic, API endpoints, cron jobs)
- `cloudflare/web/` — Cloudflare Pages + Astro (web dashboard with score search)

Each subproject has its own `package.json`, `tsconfig.json`, and `wrangler.jsonc`.

## Build & Deploy Commands

### Worker (`cloudflare/worker/`)
```bash
npm run dev       # wrangler dev (local development)
npm run deploy    # wrangler deploy (production)
```

### Web (`cloudflare/web/`)
```bash
npm run dev       # astro dev (local development)
npm run build     # astro build (production build)
npm run preview   # wrangler pages dev (preview with D1)
```

## Architecture

### Worker (`cloudflare/worker/src/`)
- **Entry point**: `index.ts` — Exports `BotManager` Durable Object + Worker fetch/scheduled handlers
- **BotManager** (Durable Object) — Singleton that polls Mastodon notifications + #Wordle hashtag timeline, and Bluesky notifications + search, on a 30-second alarm loop
- **`mastodon.ts`** — Mastodon API client (notifications, posting, relationships, hashtag timeline)
- **`bluesky.ts`** — Bluesky ATP client (notifications, search, posting)
- **`process-post.ts`** — Core Wordle processing: extract matrix, calculate score, format reply, write to D1
- **`daily-post.ts`** — Daily top scorer and global stats posts (triggered by cron)
- **`db.ts`** — D1 database queries (analyzed posts, global scores, top scores, users)
- **`shared/`** — Shared logic (calculate, extract, display, constants, enums)

### Web (`cloudflare/web/src/`)
- **Astro + Cloudflare Pages** with server-side rendering
- **`pages/index.astro`** — Homepage
- **`pages/api/search.ts`** — Paginated score search endpoint
- **`pages/api/recent-days.ts`** — Recent days stats endpoint

### HTTP Endpoints (Worker)
- `GET /bot/status` — Bot status (polling state, dry-run mode, since IDs) — public
- `POST /bot/start` — Start polling loop — requires `Authorization: Bearer <BOT_SECRET>`
- `POST /bot/stop` — Stop polling loop — requires auth
- `POST /bot/daily` — Trigger daily posts manually — requires auth
- Cron trigger (`0 0 * * *`) — Automatic daily posts at midnight UTC

### Data Storage
- **Cloudflare D1** (SQLite) — Shared by worker and web, bound as `DB`
- Database name: `wordlescorer`, same D1 instance for both subprojects
- Durable Object storage — Bot state (since IDs, alarm scheduling)

### Key Patterns
- ESM modules throughout
- Shared scoring/extraction logic lives in `cloudflare/worker/src/shared/`
- `DRY_RUN` env var (defaults to true) — set to `"false"` in wrangler.jsonc for live replies
- Sentry for error monitoring via `@sentry/cloudflare`

### Mastodon Bot: Follower vs Non-Follower Behavior
Posts from the `#Wordle` hashtag timeline are handled differently:
- **Followers**: Full processing — writes to all tables and replies to the post
- **Non-followers**: Only writes to `global_scores` — no reply, no search visibility, no daily leaderboard

### Log Prefixes
- `[bot]` — BotManager orchestration
- `[bot:masto]` — Mastodon bot activity
- `[bot:bsky]` — Bluesky bot activity
- `[cron]` — Cron-triggered daily posts
- `[DRY RUN]` appended when dry-run mode is active

### Environment Variables (Worker)
Set as secrets in Cloudflare dashboard or wrangler.jsonc vars:

| Variable | Description |
|----------|-------------|
| `MASTO_URI` | Mastodon instance URL |
| `MASTO_ACCESS_TOKEN` | Mastodon bot access token |
| `BSKY_USERNAME` | Bluesky bot username |
| `BSKY_PASSWORD` | Bluesky bot app password |
| `BOT_SECRET` | Bearer token for /bot/* endpoint auth |
| `SENTRY_DSN` | Sentry DSN for error monitoring |
| `DRY_RUN` | Set to `"false"` for live replies (default: true) |
