import "./config/load-env"; // must stay the first import
import { createServer } from "node:http";
import express from "express";
import { createApp } from "./app";
import { assertProductionConfig, ENV, googleRedirectUri } from "./config/env";
import { closeDb } from "./database/client";
import { runMigrations } from "./database/migrate";

/**
 * Entry point. Designed not to crash-loop on hosting like cPanel/Passenger:
 * - missing settings → the server still starts and every request explains what's missing (503)
 * - database unreachable → the server starts, /api/health shows the database error
 */
async function main() {
  const missing = assertProductionConfig();
  if (missing.length && ENV.isProduction) {
    console.error(`[config] missing environment variables: ${missing.join(", ")} — serving a 503 until they are set`);
    const app = express();
    app.use((_req, res) => {
      res.status(503).json({ ok: false, error: "Server is not configured yet", missing });
    });
    createServer(app).listen(ENV.port, () => console.log(`[api] listening on port ${ENV.port} (not configured)`));
    return;
  }
  if (missing.length) console.warn(`[config] missing environment variables: ${missing.join(", ")} (continuing in development mode)`);

  const server = createServer(createApp());
  server.listen(ENV.port, () => {
    console.log(`[api] listening on port ${ENV.port}`);
    console.log(`[api] public URL: ${ENV.publicUrl}`);
    console.log(`[auth] Google redirect URI (add this in Google Cloud Console): ${googleRedirectUri()}`);
    // Start answering immediately (hosts like cPanel give up on slow starts), then prepare the database.
    if (ENV.runMigrationsOnStart) {
      runMigrations().catch((error) => {
        console.error("[db] migrations failed — check DATABASE_URL and that this host can reach the database:", error instanceof Error ? error.message : error);
      });
    }
  });

  const shutdown = (signal: string) => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close(() => {
      void closeDb().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

process.on("unhandledRejection", (reason) => {
  console.error("[api] unhandled promise rejection:", reason instanceof Error ? reason.message : reason);
});

main().catch((error) => {
  console.error("[api] failed to start:", error instanceof Error ? error.message : error);
  process.exit(1);
});
