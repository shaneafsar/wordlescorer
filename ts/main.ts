import BotController from "./BotController.js";
import MongoClientInstance from './mongo.js';
import "./instrument.js";

async function runLoop() {
  while (true) {
    try {
      console.log(`[${new Date().toISOString()}] Starting BotController...`);
      await BotController.initialize();
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Error in BotController:`, err);
    }
  }
}

runLoop();
