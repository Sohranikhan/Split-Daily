import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "../../database/client.js";
import { sessions, users } from "../../models/index.js";
import { ENV } from "../../config/env.js";
import { signLoginTicket, signSessionToken, verifyLoginTicket, verifySessionToken } from "./token.service.js";
const DAY_MS = 24 * 60 * 60 * 1e3;
const TOUCH_INTERVAL_MS = 60 * 60 * 1e3;
function bearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
function clientIp(req) {
  return (req.ip ?? req.socket?.remoteAddress ?? "").slice(0, 64) || null;
}
async function insertSession(userId, meta) {
  const db = getDb();
  const expiresAt = new Date(Date.now() + ENV.sessionTtlDays * DAY_MS);
  const rows = await db.insert(sessions).values({ userId, expiresAt, userAgent: meta.userAgent?.slice(0, 512) ?? null, ipAddress: meta.ip ?? null }).returning({ publicId: sessions.publicId });
  return { sid: rows[0].publicId, expiresAt };
}
async function createSessionWithTicket(userId, meta) {
  const { sid } = await insertSession(userId, meta);
  return { sid, ticket: await signLoginTicket(sid) };
}
async function createSessionWithToken(user, meta) {
  const { sid, expiresAt } = await insertSession(user.id, meta);
  return { token: await signSessionToken(sid, user.publicId, expiresAt), expiresAt };
}
async function loadActiveSession(sid) {
  const db = getDb();
  const rows = await db.select({ session: sessions, user: users }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(and(eq(sessions.publicId, sid), isNull(sessions.revokedAt), gt(sessions.expiresAt, /* @__PURE__ */ new Date()), isNull(users.deletedAt))).limit(1);
  return rows[0] ?? null;
}
async function exchangeTicket(ticket) {
  const claims = await verifyLoginTicket(ticket);
  if (!claims) return null;
  const active = await loadActiveSession(claims.sid);
  if (!active) return null;
  const token = await signSessionToken(active.session.publicId, active.user.publicId, active.session.expiresAt);
  return { token, expiresAt: active.session.expiresAt, user: active.user };
}
async function authenticateToken(token) {
  if (!token) return null;
  const claims = await verifySessionToken(token);
  if (!claims) return null;
  const active = await loadActiveSession(claims.sid);
  if (!active || active.user.publicId !== claims.sub) return null;
  if (Date.now() - active.session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await getDb().update(sessions).set({ lastUsedAt: /* @__PURE__ */ new Date() }).where(eq(sessions.id, active.session.id));
  }
  return { user: active.user, sessionId: active.session.publicId };
}
async function authenticateRequest(req) {
  return authenticateToken(bearerToken(req));
}
async function revokeSession(sessionId) {
  await getDb().update(sessions).set({ revokedAt: /* @__PURE__ */ new Date() }).where(and(eq(sessions.publicId, sessionId), isNull(sessions.revokedAt)));
}
export {
  authenticateRequest,
  authenticateToken,
  bearerToken,
  clientIp,
  createSessionWithTicket,
  createSessionWithToken,
  exchangeTicket,
  revokeSession
};
