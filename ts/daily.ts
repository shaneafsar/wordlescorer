import BotController from "./BotController.js";
import MongoClientInstance from './mongo.js';
import "./instrument.js";

BotController.postOnly()
.then(() => {
  MongoClientInstance.close();
  process.exit(0);
})
.catch(err => {
  MongoClientInstance.close();
  console.error('Error:', err);
  process.exit(1);
});