import "../config/load-env";
import { closeDb } from "./client";
import { runMigrations } from "./migrate";

runMigrations()
  .then(() => closeDb())
  .catch(async (error) => {
    console.error("[db] migration failed:", error);
    await closeDb();
    process.exit(1);
  });
