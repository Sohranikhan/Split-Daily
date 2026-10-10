import "../config/load-env.js";
import { closeDb } from "./client.js";
import { runMigrations } from "./migrate.js";
runMigrations().then(() => closeDb()).catch(async (error) => {
  console.error("[db] migration failed:", error);
  await closeDb();
  process.exit(1);
});
