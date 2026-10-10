import { Router, type Request, type Response } from "express";
import { ENV, googleRedirectUri } from "../env";
import { buildGoogleAuthUrl, googleClient, isGoogleConfigured, randomToken } from "./google";
import { isAllowedReturnTo, withParams } from "./redirects";
import { authenticateRequest, clientIp, createSessionWithTicket, createSessionWithToken, exchangeTicket, revokeSession } from "./sessions";
import { OAUTH_STATE_TTL_MS, signOAuthState, verifyOAuthState } from "./tokens";
import { toPublicUser, upsertGoogleUser } from "./users";

const STATE_COOKIE = "ledgerly_oauth";
const STATE_COOKIE_PATH = "/api/auth/google";

function isHttps(req: Request) {
  return req.secure || ENV.publicUrl.startsWith("https://");
}

function readCookie(req: Request, name: string): string | null {
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

function setStateCookie(req: Request, res: Response, value: string) {
  res.cookie(STATE_COOKIE, value, {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax", // must survive the top-level redirect back from accounts.google.com
    path: STATE_COOKIE_PATH,
    maxAge: OAUTH_STATE_TTL_MS,
  });
}

function clearStateCookie(req: Request, res: Response) {
  res.clearCookie(STATE_COOKIE, { httpOnly: true, secure: isHttps(req), sameSite: "lax", path: STATE_COOKIE_PATH });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

/** Minimal page for errors where we have nowhere safe to redirect to. */
function sendErrorPage(res: Response, status: number, title: string, detail: string) {
  res
    .status(status)
    .type("html")
    .send(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>` +
        `<style>body{font-family:system-ui,sans-serif;background:#F7F8F5;color:#17231B;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}` +
        `main{max-width:420px;background:#fff;border:1px solid #E1E7DF;border-radius:24px;padding:28px}h1{font-size:22px;margin:0 0 8px}p{color:#56635A;line-height:1.5;margin:0}</style>` +
        `</head><body><main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(detail)}</p></main></body></html>`,
    );
}

export function createAuthRouter() {
  const router = Router();

  /** Lets the app show a clear message when Google sign-in is not configured on the server. */
  router.get("/config", (_req, res) => {
    res.json({ google: isGoogleConfigured(), redirectUri: googleRedirectUri() });
  });

  /**
   * Step 1. The app opens this URL (full-page on web, in an auth browser session on iOS/Android).
   * `returnTo` is where the app wants to land afterwards, e.g. https://app.example.com/oauth/callback
   * or ledgerly://oauth/callback.
   */
  router.get("/google/start", async (req, res) => {
    const returnTo = req.query.returnTo;
    if (!isAllowedReturnTo(returnTo)) {
      sendErrorPage(res, 400, "Sign-in link is not allowed", "This return address is not on the server's allow-list. Check WEB_APP_ORIGINS / APP_SCHEMES in server/.env.");
      return;
    }
    if (!isGoogleConfigured()) {
      res.redirect(302, withParams(returnTo, { error: "google_not_configured" }));
      return;
    }
    const state = randomToken();
    const nonce = randomToken();
    const verifier = randomToken(48);
    setStateCookie(req, res, await signOAuthState({ state, nonce, verifier, returnTo }));
    res.set("Cache-Control", "no-store");
    res.redirect(302, buildGoogleAuthUrl({ state, nonce, verifier }));
  });

  /** Step 2. Google sends the browser back here with ?code&state. */
  router.get("/google/callback", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const rawCookie = readCookie(req, STATE_COOKIE);
    const saved = rawCookie ? await verifyOAuthState(rawCookie) : null;
    clearStateCookie(req, res);

    if (!saved) {
      sendErrorPage(res, 400, "Sign-in expired", "Your sign-in attempt timed out or was started in another browser. Go back to Split Daily and try again.");
      return;
    }
    // Re-validate in case the allow-list changed during the round trip.
    if (!isAllowedReturnTo(saved.returnTo)) {
      sendErrorPage(res, 400, "Sign-in link is not allowed", "The return address is no longer allowed.");
      return;
    }
    const fail = (code: string) => res.redirect(302, withParams(saved.returnTo, { error: code }));

    if (typeof req.query.error === "string") return fail(req.query.error === "access_denied" ? "access_denied" : "google_error");
    if (req.query.state !== saved.state) return fail("state_mismatch");
    if (typeof req.query.code !== "string" || !req.query.code) return fail("missing_code");

    try {
      const profile = await googleClient.exchangeCodeForProfile(req.query.code, saved.verifier, saved.nonce);
      if (!profile.email || !profile.emailVerified) return fail("email_not_verified");
      const user = await upsertGoogleUser(profile);
      const { ticket } = await createSessionWithTicket(user.id, { userAgent: req.get("user-agent"), ip: clientIp(req) });
      res.redirect(302, withParams(saved.returnTo, { ticket }));
    } catch (error) {
      console.error("[auth] Google callback failed:", error instanceof Error ? error.message : error);
      fail("server_error");
    }
  });

  /**
   * Native sign-in (iOS / Android): the app shows Google's own account picker via the
   * Google Sign-In SDK — no browser — and posts the resulting ID token here.
   */
  router.post("/google/native", async (req, res) => {
    const idToken = typeof req.body?.idToken === "string" ? req.body.idToken : "";
    if (!idToken) {
      res.status(400).json({ error: "idToken is required" });
      return;
    }
    if (!ENV.googleClientId) {
      res.status(503).json({ error: "Google sign-in isn't set up on the server yet (GOOGLE_CLIENT_ID)." });
      return;
    }
    let profile;
    try {
      profile = await googleClient.verifyIdToken(idToken);
    } catch (error) {
      console.warn("[auth] native id token rejected:", error instanceof Error ? error.message : error);
      res.status(401).json({ error: "Google sign-in could not be verified. Please try again." });
      return;
    }
    if (!profile.email || !profile.emailVerified) {
      res.status(403).json({ error: "Your Google account email isn't verified, so it can't be used to sign in." });
      return;
    }
    try {
      const user = await upsertGoogleUser(profile);
      const session = await createSessionWithToken(user, { userAgent: req.get("user-agent"), ip: clientIp(req) });
      res.set("Cache-Control", "no-store");
      res.json({ token: session.token, expiresAt: session.expiresAt.toISOString(), user: toPublicUser(user) });
    } catch (error) {
      console.error("[auth] native sign-in failed:", error instanceof Error ? error.message : error);
      res.status(500).json({ error: "Could not complete sign-in." });
    }
  });

  /** Step 3. The app swaps the short-lived ticket for its session token. */
  router.post("/exchange", async (req, res) => {
    const ticket = typeof req.body?.ticket === "string" ? req.body.ticket : "";
    if (!ticket) {
      res.status(400).json({ error: "ticket is required" });
      return;
    }
    try {
      const result = await exchangeTicket(ticket);
      if (!result) {
        res.status(401).json({ error: "This sign-in link has expired. Please try again." });
        return;
      }
      res.set("Cache-Control", "no-store");
      res.json({ token: result.token, expiresAt: result.expiresAt.toISOString(), user: toPublicUser(result.user) });
    } catch (error) {
      console.error("[auth] exchange failed:", error instanceof Error ? error.message : error);
      res.status(500).json({ error: "Could not complete sign-in." });
    }
  });

  router.get("/me", async (req, res) => {
    try {
      const auth = await authenticateRequest(req);
      if (!auth) {
        res.status(401).json({ user: null });
        return;
      }
      res.json({ user: toPublicUser(auth.user) });
    } catch (error) {
      console.error("[auth] /me failed:", error instanceof Error ? error.message : error);
      res.status(500).json({ error: "Could not load the current user." });
    }
  });

  router.post("/logout", async (req, res) => {
    try {
      const auth = await authenticateRequest(req);
      if (auth) await revokeSession(auth.sessionId);
    } catch (error) {
      console.error("[auth] logout failed:", error instanceof Error ? error.message : error);
    }
    res.json({ success: true });
  });

  return router;
}
