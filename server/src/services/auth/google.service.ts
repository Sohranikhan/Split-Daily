import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { ENV, googleRedirectUri } from "../../config/env";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
/** Google's public signing keys (cached by jose). Replaceable in tests. */
export const googleKeys: { jwks: JWTVerifyGetKey } = {
  jwks: createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
};

export type GoogleProfile = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const pkceChallenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

export function isGoogleConfigured() {
  return Boolean(ENV.googleClientId && ENV.googleClientSecret);
}

/** Client IDs whose ID tokens we accept: the Web client (also used as serverClientId by the
 * native SDKs) plus the optional iOS / Android clients. */
export function googleAudiences() {
  return [ENV.googleClientId, ENV.googleIosClientId, ENV.googleAndroidClientId].filter(Boolean);
}

/** Verifies a Google ID token (signature via Google's JWKS, issuer, audience, expiry, optional nonce). */
async function verifyIdToken(idToken: string, options: { nonce?: string } = {}): Promise<GoogleProfile> {
  const audiences = googleAudiences();
  if (!audiences.length) throw new Error("GOOGLE_CLIENT_ID is not configured");
  const { payload } = await jwtVerify(idToken, googleKeys.jwks, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: audiences,
  });
  if (options.nonce !== undefined && payload.nonce !== options.nonce) throw new Error("Google id_token nonce mismatch");
  if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Google id_token has no subject");
  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}

export function buildGoogleAuthUrl(params: { state: string; nonce: string; verifier: string }) {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", ENV.googleClientId);
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", pkceChallenge(params.verifier));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("access_type", "online");
  return url.toString();
}

/** Exchanges the authorization code for tokens and returns the verified Google profile. */
async function exchangeCodeForProfile(code: string, verifier: string, nonce: string): Promise<GoogleProfile> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as { id_token?: string; error?: string; error_description?: string };
  if (!response.ok || !body.id_token) {
    throw new Error(`Google token exchange failed: ${body.error ?? response.status} ${body.error_description ?? ""}`.trim());
  }

  return verifyIdToken(body.id_token, { nonce });
}

/** Indirection so tests can stub the network call to Google. */
export const googleClient = { exchangeCodeForProfile, verifyIdToken };
