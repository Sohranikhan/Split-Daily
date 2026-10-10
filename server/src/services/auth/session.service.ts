import { and, eq, gt, isNull } from "drizzle-orm";
import type { Request } from "express";
import { getDb } from "../../database/client";
import { sessions, users, type User } from "../../models";
import { ENV } from "../../config/env";
import { signLoginTicket, signSessionToken, verifyLoginTicket, verifySessionToken } from "./token.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export type AuthResult = { user: User; sessionId: string };

export function bearerToken(req: Pick<Request, "headers">): string | null {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export function clientIp(req: Request) {
  return (req.ip ?? req.socket?.remoteAddress ?? "").slice(0, 64) || null;
}

type SessionMeta = { userAgent?: string | null; ip?: string | null };

async function insertSession(userId: number, meta: SessionMeta) {
  const db = getDb();
  const expiresAt = new Date(Date.now() + ENV.sessionTtlDays * DAY_MS);
  const rows = await db
    .insert(sessions)
    .values({ userId, expiresAt, userAgent: meta.userAgent?.slice(0, 512) ?? null, ipAddress: meta.ip ?? null })
    .returning({ publicId: sessions.publicId });
  return { sid: rows[0]!.publicId, expiresAt };
}

/** Creates a new server-side session and returns a one-time login ticket for it (browser redirect flow). */
export async function createSessionWithTicket(userId: number, meta: SessionMeta) {
  const { sid } = await insertSession(userId, meta);
  return { sid, ticket: await signLoginTicket(sid) };
}

/** Creates a new server-side session and returns its bearer token directly (native sign-in flow). */
export async function createSessionWithToken(user: { id: number; publicId: string }, meta: SessionMeta) {
  const { sid, expiresAt } = await insertSession(user.id, meta);
  return { token: await signSessionToken(sid, user.publicId, expiresAt), expiresAt };
}

async function loadActiveSession(sid: string) {
  const db = getDb();
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.publicId, sid), isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date()), isNull(users.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

/** Swaps a login ticket for the long-lived session token. */
export async function exchangeTicket(ticket: string) {
  const claims = await verifyLoginTicket(ticket);
  if (!claims) return null;
  const active = await loadActiveSession(claims.sid);
  if (!active) return null;
  const token = await signSessionToken(active.session.publicId, active.user.publicId, active.session.expiresAt);
  return { token, expiresAt: active.session.expiresAt, user: active.user };
}

/** Resolves the signed-in user from a bearer token, or null. */
export async function authenticateToken(token: string | null): Promise<AuthResult | null> {
  if (!token) return null;
  const claims = await verifySessionToken(token);
  if (!claims) return null;
  const active = await loadActiveSession(claims.sid);
  if (!active || active.user.publicId !== claims.sub) return null;

  if (Date.now() - active.session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await getDb().update(sessions).set({ lastUsedAt: new Date() }).where(eq(sessions.id, active.session.id));
  }
  return { user: active.user, sessionId: active.session.publicId };
}

export async function authenticateRequest(req: Pick<Request, "headers">) {
  return authenticateToken(bearerToken(req));
}

export async function revokeSession(sessionId: string) {
  await getDb().update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.publicId, sessionId), isNull(sessions.revokedAt)));
}
