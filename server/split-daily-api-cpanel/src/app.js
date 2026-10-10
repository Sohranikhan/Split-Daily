import express from "express";
import { ENV } from "./config/env.js";
import { createCorsMiddleware } from "./middleware/cors.middleware.js";
import { registerRoutes } from "./routes/index.js";
import { allowedWebOrigins } from "./utils/redirects.js";
function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (ENV.trustProxy) app.set("trust proxy", 1);
  app.use(createCorsMiddleware(allowedWebOrigins));
  app.use(express.json({ limit: "1mb" }));
  registerRoutes(app);
  return app;
}
export {
  createApp
};
