import { Router } from "express";
import * as auth from "../controllers/auth.controller";

/** /api/auth/* — sign-in endpoints used by the app before it has a session. */
export function createAuthRouter() {
  const router = Router();
  router.get("/config", auth.config);
  router.get("/google/start", auth.googleStart); // 1. browser flow: redirect to Google
  router.get("/google/callback", auth.googleCallback); // 2. Google redirects back here
  router.post("/google/native", auth.googleNative); // in-app Google sheet (iOS / Android)
  router.post("/exchange", auth.exchange); // 3. app swaps the one-time ticket for a session token
  router.get("/me", auth.me);
  router.post("/logout", auth.logout);
  return router;
}
