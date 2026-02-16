import BotController from "./BotController.js";
import "./instrument.js";
import http from 'http';

const IS_DEVELOPMENT = process.env['NODE_ENV'] === 'develop';

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
  // Start web server alongside the bot
  await startWebServer();

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
