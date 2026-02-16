# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

- **Compile TypeScript**: `npm run compile` (runs `tsc`, outputs to `./dist`)
- **Run production**: `npm run start` (bot + web server in single process)
- **Run dev mode**: `npm run dev` (sets `NODE_ENV=develop`, dry-run bot + web server)
- **Run tests**: `npm test` (vitest run) or `npm run test:watch` (vitest watch mode)
- **Post daily stats only**: `npm run daily` (prod) or `npm run daily:dev` (dev)
- **File copy step**: `npm run file-copy` — copies web assets to dist

## Architecture

This is a **Wordle scoring bot** that runs on Mastodon and Bluesky. Users mention the bot with their Wordle results, and it replies with a calculated score. A single process runs both the bot and an Express web server.

### Entry Points
- `ts/main.ts` — Unified entry: starts Express web server + `BotController` (24-hour polling cycles)
- `ts/daily.ts` — One-shot: posts daily top scorer and global stats, then exits

### Core Flow
1. **BotController** (`ts/BotController.ts`) — Orchestrates both platform bots, handles daily posts (top scorer, global stats)
2. **Platform Bots** (`ts/bots/`) — `MastoWordleBot` and `BlueskyWordleBot` listen for mentions, extract Wordle data, score it, and reply
3. **Extract** (`ts/extract/`) — Parse Wordle results from text, emoji grids, or wa11y.co image alt-text into a numeric matrix
4. **Calculate** (`ts/calculate/`) — Score a Wordle matrix: multipliers reward earlier correct letters, bonuses for fewer rows, hard mode support
5. **Display** (`ts/display/`) — Format responses: compliments, stats, percentages, date formatting
6. **DB** (`ts/db/`) — SQLite queries via `better-sqlite3` for global scores, top scores, and scorer stats

### Data Storage
- **SQLite** (`data/wordlescorer.db`) — All persistent data via `ts/db/sqlite.ts` and `ts/db/WordleData.ts`
- Tables are created automatically on first run by `WordleData` constructor
- **Search** — Server-side SQLite queries in `web/routes/search.js`, vanilla JS frontend in `web/static/javascripts/score-search.js`
- Migration script from MongoDB: `scripts/migrate-from-mongo.ts`

### Mastodon Bot: Follower vs Non-Follower Behavior
In `MastoWordleBot.handleUpdate()`, posts from the `#Wordle` hashtag stream are handled differently based on whether the user follows the bot:
- **Followers** (`isFollowingBot: true`): Full processing via `processPost()` — writes to `globalScores`, `topScores`, `analyzedPosts`, `users`, and replies to the post
- **Non-followers** (`isFollowingBot: false`): Only writes to `globalScores` — no reply, no search visibility, no daily leaderboard. This still contributes to the "Solved above X others" comparison stat used in reply messages.
- The `autoScore` field (`auto_score` in SQLite) indicates whether the bot found the post organically (true/1) vs the user @mentioned the bot (false/0)

### Key Patterns
- ESM modules throughout (`"type": "module"` in package.json, `nodenext` module resolution)
- All TS imports use `.js` extensions (required for ESM + TypeScript)
- `NODE_ENV=develop` enables dev mode (loads `.env` via dotenv, `[DRY RUN]` logging instead of posting)
- Sentry for error monitoring (`ts/instrument.ts`)
- Web UI uses Pug templates (`web/views/`) and Express (`web/app.js`)

### Log Prefixes
All console output uses structured prefixes for easy filtering:
- `[web]` — Express web server (in `ts/main.ts`)
- `[bot]` — BotController orchestration
- `[bot:masto]` — Mastodon bot activity
- `[bot:bsky]` — Bluesky bot activity
- Dry-run messages append `[DRY RUN]` after the source prefix

### Environment Variables
Required: `MASTO_URI`, `MASTO_ACCESS_TOKEN`, `BSKY_USERNAME`, `BSKY_PASSWORD`, Sentry DSN. Optional: `PORT` (default 3000). Use a `.env` file in dev mode.

### DB Sync (Replit App Storage)
- `ts/db/db-sync.ts` syncs the SQLite DB to/from Replit App Storage (`@replit/object-storage`)
- On startup: downloads DB from App Storage before SQLite opens it (top-level `await` in `main.ts` and `daily.ts`)
- Every 5 minutes: uploads DB to App Storage
- On shutdown (SIGTERM/SIGINT): final upload before exit
- Skipped entirely when not on Replit (`REPL_ID` env var absent)
- The `[db-sync]` log prefix tracks all sync activity

### Deployment Notes
- `better-sqlite3` is a native C++ addon — it must be compiled for the target platform (`npm install` handles this)
- The `data/` directory must be writable (contains `wordlescorer.db`)
- On Replit: DB persists via App Storage sync — survives redeploys. Use Reserved VM (`gce`) deployment target for best results
