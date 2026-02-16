# wordlescorer

## Intro
A Wordle scoring bot that runs on Mastodon and Bluesky. Mention the bot with your Wordle results and it replies with a calculated score. The more characters that are solved earlier in the puzzle, the more points you get!

**Note**: This bot previously supported Twitter/X but that support has been removed.

## Supported Platforms
- **Mastodon**: [@scoremywordle@mastodon.social](https://mastodon.social/@scoremywordle)
- **Bluesky**: [@scoremywordle.bsky.social](https://bsky.app/profile/scoremywordle.bsky.social)

### Features
* Mention @scoremywordle on Mastodon or Bluesky with your Wordle output and get a response with your score
* Supports reading the default square emoji Wordle output (including the high contrast version)
* Supports reading wa11y.co alt text on Wordle images if there's no default square emoji output
* Posts the top Wordler of the day ranked by score, row solved, then post time
* Posts top global stats for the day using the two most popular Wordle numbers
* Web dashboard with score search at the configured web server port

## Tech Stack
- **Runtime**: Node.js with ESM modules
- **Language**: TypeScript (compiled to `./dist`)
- **Database**: SQLite via `better-sqlite3`
- **Web**: Express + Pug templates
- **Testing**: Vitest
- **Monitoring**: Sentry

## Setup

### Prerequisites
- Node.js 18+
- npm

### Environment Variables
Set these in a `.env` file (loaded automatically in dev mode):

| Variable | Description |
|----------|-------------|
| `MASTO_URI` | Mastodon instance URL |
| `MASTO_ACCESS_TOKEN` | Mastodon bot access token |
| `BSKY_USERNAME` | Bluesky bot username |
| `BSKY_PASSWORD` | Bluesky bot app password |
| `SENTRY_DSN` | Sentry DSN for error monitoring |
| `PORT` | Web server port (default: 3000) |

### Commands
```bash
npm install            # Install dependencies
npm run compile        # Compile TypeScript to ./dist
npm run dev            # Dev mode: dry-run bot + web server (no real replies)
npm run start          # Production: bot + web server
npm test               # Run tests (vitest)
npm run test:watch     # Run tests in watch mode
npm run daily          # Post daily top scorer + global stats, then exit
npm run daily:dev      # Same as daily but dry-run
```

### Data
SQLite database lives at `data/wordlescorer.db`. A migration script from the legacy MongoDB setup is available at `scripts/migrate-from-mongo.ts`.

## Special thanks
* https://www.powerlanguage.co.uk/wordle/ - for creating Wordle!
* https://wa11y.co/ - for creating an accessible alt-text version of the game's output
* Community members who posted Wordle images with alt text & variations for testing
* https://github.com/neet/masto.js - for an excellent Mastodon JS client
* https://github.com/bluesky-social/atproto - for the AT Protocol and Bluesky API
