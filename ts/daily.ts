import BotController from "./BotController.js";
import "./instrument.js";

BotController.postOnly()
.then(() => {
  process.exit(0);
})
.catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
