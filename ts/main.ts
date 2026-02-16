// Download DB from Replit App Storage BEFORE any other imports that touch SQLite.
// db-sync has no static dependency on sqlite.ts, so this is safe to import statically.
import { downloadDB, startPeriodicSync, stopSync } from "./db/db-sync.js";
import http from 'http';

await downloadDB();

// Dynamic imports — these transitively import sqlite.ts which opens the DB on load.
// Must come AFTER downloadDB() so the file is in place first.
const { default: BotController } = await import("./BotController.js");
await import("./instrument.js");

const IS_DEVELOPMENT = process.env['NODE_ENV'] === 'develop';

// Graceful shutdown: upload DB to App Storage before exiting
process.on('SIGTERM', async () => {
  console.log('[main] SIGTERM received, syncing DB...');
  await stopSync();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[main] SIGINT received, syncing DB...');
  await stopSync();
  process.exit(0);
});

// Start the web server and wait for it to be listening
async function startWebServer(): Promise<void> {
  // @ts-ignore - JS web module, will be fully migrated in Phase 6
  const { default: app } = await import('../web/app.js');
  const port = process.env.PORT || 3000;
  app.set('port', port);
  const server = http.createServer(app);

  return new Promise((resolve, reject) => {
    server.listen(port);
    server.on('listening', () => {
      console.log(`[web] Server listening on port ${port}`);
      resolve();
    });
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.syscall !== 'listen') {
        reject(error);
        return;
      }
      if (error.code === 'EACCES') {
        console.error(`Port ${port} requires elevated privileges`);
        process.exit(1);
      } else if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use`);
        process.exit(1);
      } else {
        reject(error);
      }
    });
  });
}

async function runLoop() {
  // Start web server first — must be up before Replit's health check timeout
  await startWebServer();

  // Start periodic DB sync to App Storage (every 15 min)
  startPeriodicSync();

  while (true) {
    try {
      console.log(`[${new Date().toISOString()}] Starting BotController...${IS_DEVELOPMENT ? ' [DRY RUN MODE]' : ''}`);
      await BotController.initialize();
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error in BotController:`, err);
    }
  }
}

runLoop();
