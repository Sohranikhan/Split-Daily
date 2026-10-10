import express from "express";
import { ENV } from "./config/env";
import { createCorsMiddleware } from "./middleware/cors.middleware";
import { registerRoutes } from "./routes";
import { allowedWebOrigins } from "./utils/redirects";

/** Builds the Express app: middleware first, then routes (routes/index.ts). */
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (ENV.trustProxy) app.set("trust proxy", 1);
  app.use(createCorsMiddleware(allowedWebOrigins));
  app.use(express.json({ limit: "1mb" }));
  registerRoutes(app);
  return app;
}
