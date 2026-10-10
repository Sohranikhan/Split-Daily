import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { ENV } from "../config/env.js";
import * as schema from "../models/index.js";
let pool = null;
let db = null;
function getPool() {
  if (!ENV.databaseUrl) {
    throw new Error("DATABASE_URL is not set. Add your Postgres connection string to server/.env.");
  }
  if (!pool) {
    pool = new pg.Pool({
      connectionString: ENV.databaseUrl,
      // Small pool: shared hosting (cPanel) limits processes and memory.
      max: ENV.isProduction ? 5 : 10,
      idleTimeoutMillis: 3e4,
      // Fail fast instead of hanging forever when the database can't be reached.
      connectionTimeoutMillis: 1e4
    });
    pool.on("error", (error) => console.error("[db] idle client error:", error.message));
  }
  return pool;
}
function getDb() {
  if (!db) db = drizzle(getPool(), { schema });
  return db;
}
function setDb(instance) {
  db = instance;
}
async function closeDb() {
  await pool?.end();
  pool = null;
  db = null;
}
export {
  closeDb,
  getDb,
  getPool,
  setDb
};
