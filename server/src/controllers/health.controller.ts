import type { Request, Response } from "express";
import { getPool } from "../database/client";
import { ENV } from "../config/env";

/**
 * GET /api/health — is the server up, and can it reach the database?
 * Useful right after deploying: it tells you which of the two is the problem.
 */
export async function health(_req: Request, res: Response) {
  let database: "ok" | "not configured" | string = "not configured";
  if (ENV.databaseUrl) {
    try {
      await getPool().query("select 1");
      database = "ok";
    } catch (error) {
      database = `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  res.status(database === "ok" ? 200 : 503).json({ ok: database === "ok", server: "ok", database, timestamp: Date.now() });
}
