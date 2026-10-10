import { ENV } from "../config/env.js";
import { OAUTH_STATE_TTL_MS } from "../services/auth/token.service.js";
const STATE_COOKIE = "ledgerly_oauth";
const STATE_COOKIE_PATH = "/api/auth/google";
function isHttps(req) {
  return req.secure || ENV.publicUrl.startsWith("https://");
}
function readCookie(req, name) {
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
function setStateCookie(req, res, value) {
  res.cookie(STATE_COOKIE, value, {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    // must survive the top-level redirect back from accounts.google.com
    path: STATE_COOKIE_PATH,
    maxAge: OAUTH_STATE_TTL_MS
  });
}
function clearStateCookie(req, res) {
  res.clearCookie(STATE_COOKIE, { httpOnly: true, secure: isHttps(req), sameSite: "lax", path: STATE_COOKIE_PATH });
}
export {
  STATE_COOKIE,
  clearStateCookie,
  readCookie,
  setStateCookie
};
