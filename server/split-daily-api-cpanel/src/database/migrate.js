import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDb } from "./client.js";
function migrationsFolder() {
  if (process.env.MIGRATIONS_DIR) return path.resolve(process.env.MIGRATIONS_DIR);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [here, path.resolve(here, ".."), path.resolve(here, "..", ".."), process.cwd()].map((dir) => path.join(dir, "drizzle"));
  return candidates.find((dir) => existsSync(path.join(dir, "meta", "_journal.json"))) ?? candidates[1];
}
async function runMigrations() {
  const folder = migrationsFolder();
  console.log(`[db] applying migrations from ${folder}`);
  await migrate(getDb(), { migrationsFolder: folder });
  console.log("[db] migrations up to date");
}
export {
  migrationsFolder,
  runMigrations
};
