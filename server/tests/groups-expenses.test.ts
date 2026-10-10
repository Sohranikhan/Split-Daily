/**
 * Groups, members, invites, expense editing permissions, balances and settlements — end to end
 * through the real tRPC API and Postgres. Uses its own database (<TEST_DATABASE_URL>_ledger) so it
 * can run in parallel with the auth tests, which truncate their tables.
 *
 *   TEST_DATABASE_URL=postgres://user:pass@localhost:5432/splitdaily_test npm test
 */
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ENV } from "../src/config/env";

const baseUrl = process.env.TEST_DATABASE_URL;

async function ensureDatabase(url: string) {
  const parsed = new URL(url);
  const name = `${parsed.pathname.slice(1)}_ledger`;
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

describe.skipIf(!baseUrl)("groups, members and expenses (integration)", () => {
  let server: Server;
  let base = "";
  type Person = { token: string; id: number; publicId: string };
  let amir: Person, sara: Person, omar: Person;

  async function makeUser(sub: string, email: string, name: string): Promise<Person> {
    const { upsertGoogleUser } = await import("../src/services/auth/user.service");
    const { createSessionWithToken } = await import("../src/services/auth/session.service");
    const user = await upsertGoogleUser({ sub, email, emailVerified: true, name, picture: null });
    const { token } = await createSessionWithToken(user, {});
    return { token, id: user.id, publicId: user.publicId };
  }

  async function call<T = any>(path: string, who: Person, input?: unknown, method: "GET" | "POST" = "POST"): Promise<{ status: number; data: T; error?: { message: string; code: string } }> {
    const headers: Record<string, string> = { authorization: `Bearer ${who.token}`, "content-type": "application/json" };
    const url = method === "GET"
      ? `${base}/api/trpc/${path}${input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`}`
      : `${base}/api/trpc/${path}`;
    const response = await fetch(url, { method, headers, body: method === "POST" ? JSON.stringify({ json: input }) : undefined });
    const body = (await response.json()) as any;
    return { status: response.status, data: body.result?.data?.json, error: body.error ? { message: body.error.json.message, code: body.error.json.data?.code } : undefined };
  }

  beforeAll(async () => {
    ENV.databaseUrl = await ensureDatabase(baseUrl!);
    ENV.jwtSecret = "test-secret-test-secret-test-secret-123";
    const { closeDb } = await import("../src/database/client");
    await closeDb();
    const { runMigrations } = await import("../src/database/migrate");
    await runMigrations();
    const { createApp } = await import("../src/app");
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    amir = await makeUser("g-amir", "amir@example.com", "Amir");
    sara = await makeUser("g-sara", "sara@example.com", "Sara");
  });

  afterAll(async () => {
    server?.close();
    const { closeDb } = await import("../src/database/client");
    await closeDb();
  });

  let groupId = "";
  let expenseId = "";

  it("creates a group and adds an existing user and an invited email", async () => {
    const created = await call("groups.create", amir, { name: "Hunza trip", category: "Trip", currency: "PKR" });
    expect(created.status).toBe(200);
    groupId = created.data.publicId;

    const added = await call("groups.addMembers", amir, { groupId, emails: ["SARA@example.com", "omar@example.com"], userIds: [] });
    expect(added.status).toBe(200);
    expect(added.data.added).toEqual(["Sara"]);
    expect(added.data.invited).toEqual(["omar@example.com"]);

    const group = await call("groups.get", sara, { id: groupId }, "GET");
    expect(group.status).toBe(200);
    expect(group.data.members.map((m: any) => m.name).sort()).toEqual(["Amir", "Sara"]);
    expect(group.data.pendingInvites.map((i: any) => i.email)).toEqual(["omar@example.com"]);
  });

  it("auto-joins invited people when they sign in with that email", async () => {
    omar = await makeUser("g-omar", "omar@example.com", "Omar");
    const group = await call("groups.get", omar, { id: groupId }, "GET");
    expect(group.status).toBe(200);
    expect(group.data.members).toHaveLength(3);
    expect(group.data.pendingInvites).toHaveLength(0);
  });

  it("splits an expense and computes balances in the expense currency", async () => {
    const created = await call("expenses.create", amir, {
      description: "Jeep hire",
      amountMinor: 900000,
      currency: "PKR",
      splitMethod: "equal",
      payerIds: [amir.publicId],
      payerAmounts: { [amir.publicId]: 900000 },
      participantIds: [amir.publicId, sara.publicId, omar.publicId],
      values: {},
      groupId,
      category: "Transport",
    });
    expect(created.status).toBe(200);
    expenseId = created.data.publicId;

    const dash = await call("dashboard.summary", sara, undefined, "GET");
    const pkr = dash.data.balances.find((b: any) => b.currency === "PKR");
    expect(pkr).toMatchObject({ youOweMinor: 300000, owedToYouMinor: 0, netMinor: -300000 });

    const group = await call("groups.get", amir, { id: groupId }, "GET");
    expect(group.data.myBalances).toEqual([{ currency: "PKR", amountMinor: 600000 }]);
    expect(group.data.debts).toHaveLength(2);
  });

  it("only lets the person who added an expense edit or delete it", async () => {
    const detail = await call("expenses.get", sara, { id: expenseId }, "GET");
    expect(detail.status).toBe(200);
    expect(detail.data.canEdit).toBe(false);
    expect(detail.data.myNetMinor).toBe(-300000);

    const edit = {
      id: expenseId,
      description: "Jeep hire (2 days)",
      amountMinor: 1200000,
      currency: "PKR",
      splitMethod: "percentage",
      payerIds: [amir.publicId],
      payerAmounts: { [amir.publicId]: 1200000 },
      participantIds: [amir.publicId, sara.publicId, omar.publicId],
      values: { [amir.publicId]: 50, [sara.publicId]: 25, [omar.publicId]: 25 },
      groupId,
    };
    const denied = await call("expenses.update", sara, edit);
    expect(denied.status).toBe(403);
    expect(denied.error?.message).toContain("Only Amir");
    const deniedDelete = await call("expenses.delete", sara, { id: expenseId });
    expect(deniedDelete.status).toBe(403);

    const ok = await call("expenses.update", amir, edit);
    expect(ok.status).toBe(200);
    const after = await call("expenses.get", amir, { id: expenseId }, "GET");
    expect(after.data.amountMinor).toBe(1200000);
    expect(after.data.canEdit).toBe(true);
    expect(after.data.participants.find((p: any) => p.name === "Sara").amountMinor).toBe(300000);
    expect(after.data.values[sara.publicId]).toBe(25);

    const notes = await call("notifications.list", sara, undefined, "GET");
    expect(notes.data.some((n: any) => n.type === "expense.updated")).toBe(true);
  });

  it("blocks leaving or deleting the group until balances are settled", async () => {
    const leave = await call("groups.leave", sara, { id: groupId });
    expect(leave.status).toBe(400);
    const del = await call("groups.delete", amir, { id: groupId });
    expect(del.status).toBe(400);
    const remove = await call("groups.removeMember", sara, { groupId, userId: omar.publicId });
    expect(remove.status).toBe(403);
  });

  it("records payments and clears balances", async () => {
    const paid = await call("settlements.create", sara, { payerId: sara.publicId, receiverId: amir.publicId, amountMinor: 300000, currency: "PKR", groupId, paymentMethod: "JazzCash" });
    expect(paid.status).toBe(200);
    expect(paid.data.status).toBe("paid");
    const received = await call("settlements.create", amir, { payerId: omar.publicId, receiverId: amir.publicId, amountMinor: 300000, currency: "PKR", groupId, paymentMethod: "Cash" });
    expect(received.data.status).toBe("confirmed");

    const group = await call("groups.get", amir, { id: groupId }, "GET");
    expect(group.data.debts).toHaveLength(0);
    expect(group.data.myBalances).toEqual([]);

    const list = await call("settlements.list", amir, undefined, "GET");
    expect(list.data.find((s: any) => s.paymentMethod === "JazzCash").canConfirm).toBe(true);

    const leave = await call("groups.leave", sara, { id: groupId });
    expect(leave.status).toBe(200);
  });

  it("joins a group with an invite code", async () => {
    const link = await call("groups.inviteLink", amir, { id: groupId });
    expect(link.data.code).toMatch(/^[A-Z2-9]{8}$/);
    const preview = await call("groups.previewInvite", sara, { code: link.data.code.toLowerCase() }, "GET");
    expect(preview.data).toMatchObject({ name: "Hunza trip", alreadyMember: false });
    const joined = await call("groups.join", sara, { code: link.data.code });
    expect(joined.data).toMatchObject({ groupId, joined: true });
    const bad = await call("groups.join", sara, { code: "NOPE1234" });
    expect(bad.status).toBe(404);
  });

  it("saves settings and respects notification preferences", async () => {
    const profile = await call("account.updateProfile", sara, { name: "Sara K", defaultCurrency: "PKR" });
    expect(profile.data).toEqual({ name: "Sara K", defaultCurrency: "PKR" });
    const prefs = await call("account.updateNotifications", sara, { expenseAlerts: false });
    expect(prefs.data.expenseAlerts).toBe(false);
    const settings = await call("account.settings", sara, undefined, "GET");
    expect(settings.data).toMatchObject({ name: "Sara K", defaultCurrency: "PKR", notifications: { expenseAlerts: false, groupAlerts: true } });

    const before = (await call("notifications.list", sara, undefined, "GET")).data.length;
    await call("expenses.create", amir, { description: "Tea", amountMinor: 60000, currency: "PKR", splitMethod: "equal", payerIds: [amir.publicId], participantIds: [amir.publicId, sara.publicId], values: {}, groupId });
    const afterCount = (await call("notifications.list", sara, undefined, "GET")).data.length;
    expect(afterCount).toBe(before);

    const dash = await call("dashboard.summary", sara, undefined, "GET");
    expect(dash.data.balance).toMatchObject({ currency: "PKR", youOweMinor: 30000 });
    expect(dash.data.people[0]).toMatchObject({ name: "Amir", balances: [{ currency: "PKR", amountMinor: -30000 }] });
  });

  it("lists expenses with your share", async () => {
    const list = await call("expenses.list", sara, { groupId }, "GET");
    expect(list.status).toBe(200);
    const tea = list.data.find((e: any) => e.description === "Tea");
    expect(tea).toMatchObject({ paidByName: "Amir", myNetMinor: -30000, groupName: "Hunza trip" });
  });

  it("deletes an account and signs it out everywhere", async () => {
    const temp = await makeUser("g-temp", "temp@example.com", "Temp");
    const denied = await call("account.delete", temp, { confirm: "nope" });
    expect(denied.status).toBe(400);
    const ok = await call("account.delete", temp, { confirm: "DELETE" });
    expect(ok.status).toBe(200);
    const after = await call("account.settings", temp, undefined, "GET");
    expect(after.status).toBe(401);
  });
});
