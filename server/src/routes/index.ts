import fs from "node:fs";
import path from "node:path";
import express, { type Express } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { ENV } from "../config/env";
import { health } from "../controllers/health.controller";
import { deleteAccount, privacyPolicy } from "../controllers/legal.controller";
import { createContext } from "../middleware/context";
import { appRouter } from "./api.router";
import { createAuthRouter } from "./auth.routes";

/** Every URL the server answers, in one place. */
export function registerRoutes(app: Express) {
  app.get("/api/health", health);
  app.get(["/privacy", "/privacy-policy"], privacyPolicy);
  app.get(["/delete-account", "/account-deletion"], deleteAccount);
  app.use("/api/auth", createAuthRouter());
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path: procedure }) {
        if (error.code === "INTERNAL_SERVER_ERROR") console.error(`[trpc] ${procedure ?? "?"} failed:`, error.message);
      },
    }),
  );
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Optional: serve the exported Expo web app from the same server.
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
