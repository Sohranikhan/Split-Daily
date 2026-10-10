import fs from "node:fs";
import path from "node:path";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { ENV } from "../config/env.js";
import { health } from "../controllers/health.controller.js";
import { createContext } from "../middleware/context.js";
import { appRouter } from "./api.router.js";
import { createAuthRouter } from "./auth.routes.js";
function registerRoutes(app) {
  app.get("/api/health", health);
  app.use("/api/auth", createAuthRouter());
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path: procedure }) {
        if (error.code === "INTERNAL_SERVER_ERROR") console.error(`[trpc] ${procedure ?? "?"} failed:`, error.message);
      }
    })
  );
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  if (ENV.webDistDir) {
    const dir = path.resolve(ENV.webDistDir);
    const indexHtml = path.join(dir, "index.html");
    if (fs.existsSync(indexHtml)) {
      app.use(express.static(dir, { index: false, extensions: ["html"], maxAge: "1h" }));
      app.get("*", (_req, res) => res.sendFile(indexHtml));
      console.log(`[web] serving web app from ${dir}`);
    } else {
      console.warn(`[web] WEB_DIST_DIR is set but ${indexHtml} does not exist; skipping web hosting`);
    }
  }
}
export {
  registerRoutes
};
