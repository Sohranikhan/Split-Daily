import { Router } from "express";
import * as auth from "../controllers/auth.controller.js";
function createAuthRouter() {
  const router = Router();
  router.get("/config", auth.config);
  router.get("/google/start", auth.googleStart);
  router.get("/google/callback", auth.googleCallback);
  router.post("/google/native", auth.googleNative);
  router.post("/exchange", auth.exchange);
  router.get("/me", auth.me);
  router.post("/logout", auth.logout);
  return router;
}
export {
  createAuthRouter
};
