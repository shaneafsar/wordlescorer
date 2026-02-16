// Download DB from Replit App Storage BEFORE any other imports that touch SQLite
import { downloadDB, uploadDB } from "./db/db-sync.js";
await downloadDB();

// Dynamic imports — these transitively import sqlite.ts
const { default: BotController } = await import("./BotController.js");
await import("./instrument.js");

BotController.postOnly()
.then(async () => {
  await uploadDB();
  process.exit(0);
})
.catch(async (err) => {
  console.error('Error:', err);
  await uploadDB();
  process.exit(1);
});
