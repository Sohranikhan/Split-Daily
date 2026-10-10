import type { RequestHandler } from "express";

/**
 * CORS for the web app. Native apps send no Origin header and are unaffected.
 * Auth uses bearer tokens (no cookies), so credentials are not needed.
 */
export function createCorsMiddleware(allowedOrigins: () => string[]): RequestHandler {
  return (req, res, next) => {
    const origin = req.headers.origin;
    res.vary("Origin");
    if (origin && allowedOrigins().includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, X-Requested-With, trpc-accept");
      res.header("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  };
}
