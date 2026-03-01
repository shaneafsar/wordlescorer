# wordlescorer

## Intro
A Wordle scoring bot that runs on Mastodon and Bluesky. Mention the bot with your Wordle results and it replies with a calculated score. The more characters that are solved earlier in the puzzle, the more points you get!

## Supported Platforms
- **Mastodon**: [@scoremywordle@mastodon.social](https://mastodon.social/@scoremywordle)
- **Bluesky**: [@scoremywordle.bsky.social](https://bsky.app/profile/scoremywordle.bsky.social)

### Features
* Mention @scoremywordle on Mastodon or Bluesky with your Wordle output and get a response with your score
* Supports reading the default square emoji Wordle output (including the high contrast version)
* Supports reading wa11y.co alt text on Wordle images if there's no default square emoji output
* Posts the top Wordler of the day ranked by score, row solved, then post time
* Posts top global stats for the day using the two most popular Wordle numbers
* Web dashboard with score search

## Tech Stack
- **Runtime**: Cloudflare Workers (bot) + Cloudflare Pages (web)
- **Language**: TypeScript
- **Database**: Cloudflare D1 (SQLite)
- **Web**: Astro
- **Monitoring**: Sentry

## Project Structure
```
cloudflare/
  worker/   — Cloudflare Worker (bot logic, API, cron)
  web/      — Cloudflare Pages (Astro web dashboard)
```

Each subproject has its own `package.json` and is deployed independently.

## Setup

### Prerequisites
- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- Cloudflare account with D1 database

### Worker Development
```bash
cd cloudflare/worker
npm install
npm run dev        # Local dev server
npm run deploy     # Deploy to Cloudflare
```

### Web Development
```bash
cd cloudflare/web
npm install
npm run dev        # Local dev server
npm run build      # Build for production
```

### Environment Variables
Set these as secrets in the Cloudflare dashboard:

| Variable | Description |
|----------|-------------|
| `MASTO_URI` | Mastodon instance URL |
| `MASTO_ACCESS_TOKEN` | Mastodon bot access token |
| `BSKY_USERNAME` | Bluesky bot username |
| `BSKY_PASSWORD` | Bluesky bot app password |
| `BOT_SECRET` | Bearer token for bot API endpoints |
| `SENTRY_DSN` | Sentry DSN for error monitoring |

## Special thanks
* https://www.powerlanguage.co.uk/wordle/ - for creating Wordle!
* https://wa11y.co/ - for creating an accessible alt-text version of the game's output
* Community members who posted Wordle images with alt text & variations for testing
* https://github.com/neet/masto.js - for an excellent Mastodon JS client
* https://github.com/bluesky-social/atproto - for the AT Protocol and Bluesky API
