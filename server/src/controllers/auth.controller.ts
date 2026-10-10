import type { Request, Response } from "express";
import { ENV, googleRedirectUri } from "../config/env";
import { buildGoogleAuthUrl, googleClient, isGoogleConfigured, randomToken } from "../services/auth/google.service";
import { authenticateRequest, clientIp, createSessionWithTicket, createSessionWithToken, exchangeTicket, revokeSession } from "../services/auth/session.service";
import { signOAuthState, verifyOAuthState } from "../services/auth/token.service";
import { upsertGoogleUser } from "../services/auth/user.service";
import { clearStateCookie, readCookie, setStateCookie, STATE_COOKIE } from "../utils/oauth-cookie";
import { isAllowedReturnTo, withParams } from "../utils/redirects";
import { sendErrorPage } from "../views/error-page.view";
import { toPublicUser } from "../views/user.view";

/**
 * Auth controller: Google sign-in (browser redirect flow and native in-app flow),
 * ticket exchange, current user and logout. Routes are mapped in routes/auth.routes.ts.
 */

/** Lets the app show a clear message when Google sign-in is not configured on the server. */
export function config(_req: Request, res: Response) {
    res.json({ google: isGoogleConfigured(), redirectUri: googleRedirectUri() });
  }

/**
   * Step 1. The app opens this URL (full-page on web, in an auth browser session on iOS/Android).
   * `returnTo` is where the app wants to land afterwards, e.g. https://app.example.com/oauth/callback
   * or ledgerly://oauth/callback.
   */
export async function googleStart(req: Request, res: Response) {
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
  }

/** Step 2. Google sends the browser back here with ?code&state. */
export async function googleCallback(req: Request, res: Response) {
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
  }

/**
   * Native sign-in (iOS / Android): the app shows Google's own account picker via the
   * Google Sign-In SDK — no browser — and posts the resulting ID token here.
   */
export async function googleNative(req: Request, res: Response) {
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
  }

/** Step 3. The app swaps the short-lived ticket for its session token. */
export async function exchange(req: Request, res: Response) {
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
  }

export async function me(req: Request, res: Response) {
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
  }

export async function logout(req: Request, res: Response) {
    try {
      const auth = await authenticateRequest(req);
      if (auth) await revokeSession(auth.sessionId);
    } catch (error) {
      console.error("[auth] logout failed:", error instanceof Error ? error.message : error);
    }
    res.json({ success: true });
  }
