import BotController from "./BotController.js";
import MongoClientInstance from './mongo.js';
import "./instrument.js";

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

BotController.initialize()
  .then(() => wait(24 * 60 * 60 * 1000)) // wait 24 hours
  .then(() => {
    MongoClientInstance.close();
    process.exit(0);
  })
/*.catch(err => {
  MongoClientInstance.close();
  console.error('Error:', err);
  process.exit(1);
});*/
