import "./config/load-env.js";
import { createServer } from "node:http";
import express from "express";
import { createApp } from "./app.js";
import { assertProductionConfig, ENV, googleRedirectUri } from "./config/env.js";
import { closeDb } from "./database/client.js";
import { runMigrations } from "./database/migrate.js";
async function main() {
  const missing = assertProductionConfig();
  if (missing.length && ENV.isProduction) {
    console.error(`[config] missing environment variables: ${missing.join(", ")} \u2014 serving a 503 until they are set`);
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
    console.log("Server running on 3000");
    
    //     if (ENV.runMigrationsOnStart) {
    //   runMigrations().catch((error) => {
    //     console.error("[db] migrations failed \u2014 check DATABASE_URL and that this host can reach the database:", error instanceof Error ? error.message : error);
    //   });
    // }
  });
  const shutdown = (signal) => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close(() => {
      void closeDb().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 1e4).unref();
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
