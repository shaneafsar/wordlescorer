import initServer from "../web/init-server.js";
import BotController from "./BotController.js";

await BotController.initialize();
initServer();