/**
 * End-to-end test of Google sign-in against a real Postgres database.
 * Only the network call to Google is stubbed.
 *
 *   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/ledgerly_test npm test
 */
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENV } from "../src/config/env";

const databaseUrl = process.env.TEST_DATABASE_URL;
const WEB_CALLBACK = "https://app.example.com/oauth/callback";

describe.skipIf(!databaseUrl)("Google sign-in flow (integration)", () => {
  let server: Server;
  let base = "";
  let google: typeof import("../src/services/auth/google.service");
  let currentProfile = { sub: "google-sub-1", email: "amir@example.com", emailVerified: true, name: "Amir Test", picture: "https://example.com/a.png" };

  beforeAll(async () => {
    ENV.databaseUrl = databaseUrl!;
    ENV.jwtSecret = "test-secret-test-secret-test-secret-123";
    ENV.googleClientId = "test-client.apps.googleusercontent.com";
    ENV.googleClientSecret = "test-secret";
    ENV.webOrigins = ["https://app.example.com"];
    ENV.publicUrl = "http://api.test";

    const { runMigrations } = await import("../src/database/migrate");
    const { getPool } = await import("../src/database/client");
    await runMigrations();
    await getPool().query(`TRUNCATE users, accounts, sessions, groups, group_members, expenses, expense_participants, expense_payers, activity_logs, notifications, settlements RESTART IDENTITY CASCADE`);

    google = await import("../src/services/auth/google.service");
    const { createApp } = await import("../src/app");
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server?.close();
    const { closeDb } = await import("../src/database/client");
    await closeDb();
  });

  async function signIn(returnTo = WEB_CALLBACK) {
    const start = await fetch(`${base}/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`, { redirect: "manual" });
    expect(start.status).toBe(302);
    const googleUrl = new URL(start.headers.get("location")!);
    expect(googleUrl.origin).toBe("https://accounts.google.com");
    expect(googleUrl.searchParams.get("redirect_uri")).toBe("http://api.test/api/auth/google/callback");
    expect(googleUrl.searchParams.get("code_challenge_method")).toBe("S256");
    const cookie = start.headers.get("set-cookie")!.split(";")[0]!;
    expect(cookie.startsWith("ledgerly_oauth=")).toBe(true);

    google.googleClient.exchangeCodeForProfile = async (code, verifier, nonce) => {
      expect(code).toBe("auth-code");
      expect(google.pkceChallenge(verifier)).toBe(googleUrl.searchParams.get("code_challenge"));
      expect(nonce).toBe(googleUrl.searchParams.get("nonce"));
      return currentProfile;
    };

    const callback = await fetch(
      `${base}/api/auth/google/callback?code=auth-code&state=${googleUrl.searchParams.get("state")}`,
      { redirect: "manual", headers: { cookie } },
    );
    expect(callback.status).toBe(302);
    const landing = new URL(callback.headers.get("location")!);
    return { landing, ticket: landing.searchParams.get("ticket"), cookie, googleUrl };
  }

  async function exchange(ticket: string) {
    const response = await fetch(`${base}/api/auth/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://app.example.com" },
      body: JSON.stringify({ ticket }),
    });
    return { response, body: (await response.json()) as { token: string; user: { id: number; email: string; name: string } } };
  }

  const trpc = async (path: string, token: string, input?: unknown, method: "GET" | "POST" = "POST") => {
    const url = method === "GET"
      ? `${base}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input ?? null }))}`
      : `${base}/api/trpc/${path}`;
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: method === "POST" ? JSON.stringify({ json: input }) : undefined,
    });
    return { status: response.status, body: (await response.json()) as any };
  };

  it("signs in on web, exchanges the ticket and loads the user", async () => {
    const { landing, ticket } = await signIn();
    expect(`${landing.origin}${landing.pathname}`).toBe(WEB_CALLBACK);
    expect(ticket).toBeTruthy();

    const { response, body } = await exchange(ticket!);
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    expect(body.user.email).toBe("amir@example.com");
    expect(body.user.name).toBe("Amir Test");

    const me = await fetch(`${base}/api/auth/me`, { headers: { authorization: `Bearer ${body.token}` } });
    expect(me.status).toBe(200);
    expect(((await me.json()) as any).user.email).toBe("amir@example.com");

    const trpcMe = await trpc("auth.me", body.token, undefined, "GET");
    expect(trpcMe.body.result.data.json.email).toBe("amir@example.com");
  });

  it("works for the native deep-link scheme and reuses the same account", async () => {
    const first = await exchange((await signIn()).ticket!);
    const { landing, ticket } = await signIn("ledgerly://oauth/callback");
    expect(landing.protocol).toBe("ledgerly:");
    const second = await exchange(ticket!);
    expect(second.body.user.id).toBe(first.body.user.id);
  });

  it("links a new Google identity to an existing user with the same verified email", async () => {
    const original = await exchange((await signIn()).ticket!);
    currentProfile = { ...currentProfile, sub: "google-sub-2" };
    const linked = await exchange((await signIn()).ticket!);
    expect(linked.body.user.id).toBe(original.body.user.id);
    currentProfile = { ...currentProfile, sub: "google-sub-1" };
  });

  it("runs protected tRPC procedures for the signed-in user", async () => {
    const { body } = await exchange((await signIn()).ticket!);
    const unauth = await trpc("dashboard.summary", "not-a-token", undefined, "GET");
    expect(unauth.status).toBe(401);

    const group = await trpc("groups.create", body.token, { name: "Lisbon trip", category: "Trip", currency: "USD" });
    expect(group.status).toBe(200);
    const groupId = group.body.result.data.json.publicId;

    const expense = await trpc("expenses.create", body.token, {
      description: "Dinner",
      amountMinor: 4200,
      currency: "USD",
      splitMethod: "equal",
      payerIds: [String(body.user.id)],
      payerAmounts: { [body.user.id]: 4200 },
      participantIds: [String(body.user.id)],
      values: {},
      groupId,
    });
    expect(expense.status).toBe(200);

    const dashboard = await trpc("dashboard.summary", body.token, undefined, "GET");
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.result.data.json.groups[0].name).toBe("Lisbon trip");
    expect(dashboard.body.result.data.json.activity.some((item: { title: string }) => item.title === "Dinner")).toBe(true);
  });

  it("revokes the session on logout", async () => {
    const { ticket } = await signIn();
    const { body } = await exchange(ticket!);
    const logout = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: { authorization: `Bearer ${body.token}` } });
    expect(logout.status).toBe(200);
    const me = await fetch(`${base}/api/auth/me`, { headers: { authorization: `Bearer ${body.token}` } });
    expect(me.status).toBe(401);
    const replay = await exchange(ticket!);
    expect(replay.response.status).toBe(401);
  });

  it("rejects tampered state, missing cookie, unverified email and foreign redirects", async () => {
    const start = await fetch(`${base}/api/auth/google/start?returnTo=${encodeURIComponent(WEB_CALLBACK)}`, { redirect: "manual" });
    const cookie = start.headers.get("set-cookie")!.split(";")[0]!;
    const mismatch = await fetch(`${base}/api/auth/google/callback?code=x&state=wrong`, { redirect: "manual", headers: { cookie } });
    expect(new URL(mismatch.headers.get("location")!).searchParams.get("error")).toBe("state_mismatch");

    const noCookie = await fetch(`${base}/api/auth/google/callback?code=x&state=y`, { redirect: "manual" });
    expect(noCookie.status).toBe(400);

    currentProfile = { ...currentProfile, emailVerified: false };
    const { landing } = await signIn();
    expect(landing.searchParams.get("error")).toBe("email_not_verified");
    currentProfile = { ...currentProfile, emailVerified: true };

    const evil = await fetch(`${base}/api/auth/google/start?returnTo=${encodeURIComponent("https://evil.example.net/cb")}`, { redirect: "manual" });
    expect(evil.status).toBe(400);

    const denied = await fetch(`${base}/api/auth/google/callback?error=access_denied`, { redirect: "manual", headers: { cookie } });
    expect(new URL(denied.headers.get("location")!).searchParams.get("error")).toBe("access_denied");
  });
});
