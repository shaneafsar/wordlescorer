import initServer from "../server/init-server.js";
import BotController from "./BotController";

await BotController.initialize();
initServer();