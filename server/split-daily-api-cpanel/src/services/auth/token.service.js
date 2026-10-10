import { SignJWT, jwtVerify } from "jose";
import { ENV } from "../../config/env.js";
const ISSUER = "ledgerly-api";
function secretKey() {
  if (!ENV.jwtSecret) throw new Error("JWT_SECRET is not configured.");
  return new TextEncoder().encode(ENV.jwtSecret);
}
async function sign(kind, claims, expiresAt) {
  return new SignJWT({ ...claims, typ: kind }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuer(ISSUER).setAudience(kind).setIssuedAt().setExpirationTime(Math.floor(expiresAt.getTime() / 1e3)).sign(secretKey());
}
async function verify(kind, token) {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, audience: kind, algorithms: ["HS256"] });
    if (payload.typ !== kind) return null;
    return payload;
  } catch {
    return null;
  }
}
const signSessionToken = (sid, userPublicId, expiresAt) => sign("session", { sid, sub: userPublicId }, expiresAt);
const verifySessionToken = (token) => verify("session", token);
const LOGIN_TICKET_TTL_MS = 2 * 60 * 1e3;
const signLoginTicket = (sid) => sign("login_ticket", { sid }, new Date(Date.now() + LOGIN_TICKET_TTL_MS));
const verifyLoginTicket = (token) => verify("login_ticket", token);
const OAUTH_STATE_TTL_MS = 10 * 60 * 1e3;
const signOAuthState = (value) => sign("oauth_state", value, new Date(Date.now() + OAUTH_STATE_TTL_MS));
const verifyOAuthState = (token) => verify("oauth_state", token);
export {
  LOGIN_TICKET_TTL_MS,
  OAUTH_STATE_TTL_MS,
  signLoginTicket,
  signOAuthState,
  signSessionToken,
  verifyLoginTicket,
  verifyOAuthState,
  verifySessionToken
};
