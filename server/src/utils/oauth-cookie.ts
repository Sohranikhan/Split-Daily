import type { Request, Response } from "express";
import { ENV } from "../config/env";
import { OAUTH_STATE_TTL_MS } from "../services/auth/token.service";

/** Short-lived cookie that carries the signed OAuth state between /google/start and /google/callback. */
export const STATE_COOKIE = "ledgerly_oauth";
const STATE_COOKIE_PATH = "/api/auth/google";

function isHttps(req: Request) {
  return req.secure || ENV.publicUrl.startsWith("https://");
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      try {
        return decodeURIComponent(part.slice(index + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function setStateCookie(req: Request, res: Response, value: string) {
  res.cookie(STATE_COOKIE, value, {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax", // must survive the top-level redirect back from accounts.google.com
    path: STATE_COOKIE_PATH,
    maxAge: OAUTH_STATE_TTL_MS,
  });
}

export function clearStateCookie(req: Request, res: Response) {
  res.clearCookie(STATE_COOKIE, { httpOnly: true, secure: isHttps(req), sameSite: "lax", path: STATE_COOKIE_PATH });
}
