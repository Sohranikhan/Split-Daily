import { SignJWT, jwtVerify } from "jose";
import { ENV } from "../env";

const ISSUER = "ledgerly-api";

function secretKey() {
  if (!ENV.jwtSecret) throw new Error("JWT_SECRET is not configured.");
  return new TextEncoder().encode(ENV.jwtSecret);
}

type TokenKind = "session" | "login_ticket" | "oauth_state";

async function sign(kind: TokenKind, claims: Record<string, unknown>, expiresAt: Date) {
  return new SignJWT({ ...claims, typ: kind })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setAudience(kind)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secretKey());
}

async function verify<T extends Record<string, unknown>>(kind: TokenKind, token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, audience: kind, algorithms: ["HS256"] });
    if (payload.typ !== kind) return null;
    return payload as unknown as T;
  } catch {
    return null;
  }
}

/** Long-lived bearer token. Only carries the session id; the session row is the source of truth. */
export const signSessionToken = (sid: string, userPublicId: string, expiresAt: Date) =>
  sign("session", { sid, sub: userPublicId }, expiresAt);
export const verifySessionToken = (token: string) => verify<{ sid: string; sub: string }>("session", token);

/** Short-lived (2 min) ticket placed in the redirect URL; the app swaps it for a session token. */
export const LOGIN_TICKET_TTL_MS = 2 * 60 * 1000;
export const signLoginTicket = (sid: string) => sign("login_ticket", { sid }, new Date(Date.now() + LOGIN_TICKET_TTL_MS));
export const verifyLoginTicket = (token: string) => verify<{ sid: string }>("login_ticket", token);

/** OAuth round-trip state kept in an httpOnly cookie on the API domain (CSRF + PKCE + nonce). */
export type OAuthState = { state: string; nonce: string; verifier: string; returnTo: string };
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
export const signOAuthState = (value: OAuthState) => sign("oauth_state", value, new Date(Date.now() + OAUTH_STATE_TTL_MS));
export const verifyOAuthState = (token: string) => verify<OAuthState>("oauth_state", token);
