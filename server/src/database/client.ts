import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { ENV } from "../config/env";
import * as schema from "../models";

export type Database = NodePgDatabase<typeof schema>;

let pool: pg.Pool | null = null;
let db: Database | null = null;

export function getPool(): pg.Pool {
  if (!ENV.databaseUrl) {
    throw new Error("DATABASE_URL is not set. Add your Postgres connection string to server/.env.");
  }
  if (!pool) {
    pool = new pg.Pool({
      connectionString: ENV.databaseUrl,
      // Small pool: shared hosting (cPanel) limits processes and memory.
      max: ENV.isProduction ? 5 : 10,
      idleTimeoutMillis: 30_000,
      // Fail fast instead of hanging forever when the database can't be reached.
      connectionTimeoutMillis: 10_000,
    });
    pool.on("error", (error) => console.error("[db] idle client error:", error.message));
  }
  return pool;
}

/** Shared Drizzle instance. Throws a clear error when the database is not configured. */
export function getDb(): Database {
  if (!db) db = drizzle(getPool(), { schema });
  return db;
}

/** Test hook: inject a different Drizzle instance (e.g. an in-memory database). */
export function setDb(instance: Database | null) {
  db = instance;
}

export async function closeDb() {
  await pool?.end();
  pool = null;
  db = null;
}
