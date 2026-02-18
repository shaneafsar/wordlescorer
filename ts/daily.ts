// Download DB from Replit App Storage BEFORE any other imports that touch SQLite.
// Note: daily.ts is read-only — it never uploads the DB back, to avoid
// overwriting changes made by the always-on main app.
import { downloadDB } from "./db/db-sync.js";
await downloadDB();

// Dynamic imports — these transitively import sqlite.ts
const { default: BotController } = await import("./BotController.js");
await import("./instrument.js");

BotController.postOnly()
.then(() => {
  process.exit(0);
})
.catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
