import { ENV, googleRedirectUri } from "../config/env.js";
import { buildGoogleAuthUrl, googleClient, isGoogleConfigured, randomToken } from "../services/auth/google.service.js";
import { authenticateRequest, clientIp, createSessionWithTicket, createSessionWithToken, exchangeTicket, revokeSession } from "../services/auth/session.service.js";
import { signOAuthState, verifyOAuthState } from "../services/auth/token.service.js";
import { upsertGoogleUser } from "../services/auth/user.service.js";
import { clearStateCookie, readCookie, setStateCookie, STATE_COOKIE } from "../utils/oauth-cookie.js";
import { isAllowedReturnTo, withParams } from "../utils/redirects.js";
import { sendErrorPage } from "../views/error-page.view.js";
import { toPublicUser } from "../views/user.view.js";
function config(_req, res) {
  res.json({ google: isGoogleConfigured(), redirectUri: googleRedirectUri() });
}
async function googleStart(req, res) {
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
async function googleCallback(req, res) {
  res.set("Cache-Control", "no-store");
  const rawCookie = readCookie(req, STATE_COOKIE);
  const saved = rawCookie ? await verifyOAuthState(rawCookie) : null;
  clearStateCookie(req, res);
  if (!saved) {
    sendErrorPage(res, 400, "Sign-in expired", "Your sign-in attempt timed out or was started in another browser. Go back to Split Daily and try again.");
    return;
  }
  if (!isAllowedReturnTo(saved.returnTo)) {
    sendErrorPage(res, 400, "Sign-in link is not allowed", "The return address is no longer allowed.");
    return;
  }
  const fail = (code) => res.redirect(302, withParams(saved.returnTo, { error: code }));
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
async function googleNative(req, res) {
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
async function exchange(req, res) {
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
async function me(req, res) {
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
async function logout(req, res) {
  try {
    const auth = await authenticateRequest(req);
    if (auth) await revokeSession(auth.sessionId);
  } catch (error) {
    console.error("[auth] logout failed:", error instanceof Error ? error.message : error);
  }
  res.json({ success: true });
}
export {
  config,
  exchange,
  googleCallback,
  googleNative,
  googleStart,
  logout,
  me
};
