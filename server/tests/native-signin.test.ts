/**
 * Native (in-app) Google sign-in: the app posts a Google ID token, no browser involved.
 * Token verification runs for real against a locally generated "Google" signing key.
 * The endpoint test needs Postgres: TEST_DATABASE_URL=postgres://... npm test
 */
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type CryptoKey } from "jose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENV } from "../src/config/env";
import { googleClient, googleKeys } from "../src/services/auth/google.service";

const WEB_CLIENT = "web-client.apps.googleusercontent.com";
const IOS_CLIENT = "ios-client.apps.googleusercontent.com";
let privateKey: CryptoKey;

async function googleToken(claims: Record<string, unknown>, opts: { aud?: string; iss?: string; key?: CryptoKey; exp?: string } = {}) {
  return new SignJWT({ email: "native@example.com", email_verified: true, name: "Native User", picture: "https://example.com/p.png", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(opts.iss ?? "https://accounts.google.com")
    .setAudience(opts.aud ?? WEB_CLIENT)
    .setSubject("native-sub-1")
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "1h")
    .sign(opts.key ?? privateKey);
}

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = pair.privateKey as CryptoKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "test-key", alg: "RS256", use: "sig" };
  googleKeys.jwks = createLocalJWKSet({ keys: [jwk] });
  ENV.googleClientId = WEB_CLIENT;
  ENV.googleIosClientId = IOS_CLIENT;
  ENV.googleAndroidClientId = "";
});

describe("Google ID token verification", () => {
  it("accepts tokens for the web (serverClientId) and iOS client IDs", async () => {
    const profile = await googleClient.verifyIdToken(await googleToken({}));
    expect(profile).toMatchObject({ sub: "native-sub-1", email: "native@example.com", emailVerified: true, name: "Native User" });
    await expect(googleClient.verifyIdToken(await googleToken({}, { aud: IOS_CLIENT }))).resolves.toBeTruthy();
  });

  it("rejects other apps' tokens, wrong issuers, expired tokens and forged signatures", async () => {
    await expect(googleClient.verifyIdToken(await googleToken({}, { aud: "someone-else.apps.googleusercontent.com" }))).rejects.toThrow();
    await expect(googleClient.verifyIdToken(await googleToken({}, { iss: "https://evil.example.com" }))).rejects.toThrow();
    await expect(googleClient.verifyIdToken(await googleToken({}, { exp: "-1m" }))).rejects.toThrow();
    const other = await generateKeyPair("RS256");
    await expect(googleClient.verifyIdToken(await googleToken({}, { key: other.privateKey as CryptoKey }))).rejects.toThrow();
  });
});

const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("POST /api/auth/google/native (integration)", () => {
  let server: Server;
  let base = "";

  beforeAll(async () => {
    ENV.databaseUrl = databaseUrl!;
    ENV.jwtSecret = "test-secret-test-secret-test-secret-123";
    const { runMigrations } = await import("../src/database/migrate");
    await runMigrations();
    const { createApp } = await import("../src/app");
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server?.close();
    const { closeDb } = await import("../src/database/client");
    await closeDb();
  });

  const post = (body: unknown) =>
    fetch(`${base}/api/auth/google/native`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("signs in with a Google ID token and returns a working session token", async () => {
    const response = await post({ idToken: await googleToken({}) });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { token: string; user: { id: number; email: string } };
    expect(body.user.email).toBe("native@example.com");

    const me = await fetch(`${base}/api/auth/me`, { headers: { authorization: `Bearer ${body.token}` } });
    expect(me.status).toBe(200);

    const again = (await (await post({ idToken: await googleToken({}) })).json()) as { user: { id: number } };
    expect(again.user.id).toBe(body.user.id);

    await fetch(`${base}/api/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${body.token}` } });
    expect((await fetch(`${base}/api/auth/me`, { headers: { authorization: `Bearer ${body.token}` } })).status).toBe(401);
  });

  it("rejects missing, invalid and unverified-email tokens", async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ idToken: "not-a-jwt" })).status).toBe(401);
    expect((await post({ idToken: await googleToken({}, { aud: "other.apps.googleusercontent.com" }) })).status).toBe(401);
    expect((await post({ idToken: await googleToken({ email_verified: false }) })).status).toBe(403);
  });
});
