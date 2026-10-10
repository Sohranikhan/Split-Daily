import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import type { Database } from "../database/client";
import { activityLogs, groupMembers, groups, notificationPreferences, notifications, users } from "../models";
import type { NotificationPreferences } from "../../../shared/domain";

/** A Drizzle transaction (or the db itself — both expose the same query API). */
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0] | Database;

export const badRequest = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });
export const forbidden = (message: string) => new TRPCError({ code: "FORBIDDEN", message });
export const notFound = (message: string) => new TRPCError({ code: "NOT_FOUND", message });

export const displayName = (user: { name: string | null; email: string | null } | undefined | null) =>
  user?.name?.trim() || user?.email?.split("@")[0] || "Someone";

/** Resolves numeric ids or public ids to internal user ids, in order. Throws if any is unknown or duplicated. */
export async function resolveUserIds(tx: Tx, identifiers: string[]) {
  const numericIds = identifiers.map(Number).filter(Number.isInteger);
  const publicIds = identifiers.filter((value) => !Number.isInteger(Number(value)));
  if (!identifiers.length) return [];
  const conditions = [
    numericIds.length ? inArray(users.id, numericIds) : undefined,
    publicIds.length ? inArray(users.publicId, publicIds) : undefined,
  ].filter(Boolean);
  const rows = await tx.select({ id: users.id, publicId: users.publicId }).from(users).where(or(...conditions));
  const byIdentifier = new Map<string, number>();
  for (const row of rows) {
    byIdentifier.set(String(row.id), row.id);
    byIdentifier.set(row.publicId, row.id);
  }
  const resolved = identifiers.map((identifier) => byIdentifier.get(identifier)).filter((id): id is number => id !== undefined);
  if (resolved.length !== identifiers.length || new Set(resolved).size !== resolved.length) {
    throw badRequest("Every payer and participant must be a valid, unique person.");
  }
  return resolved;
}

export async function loadUsers(tx: Tx, ids: number[]) {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map<number, { id: number; publicId: string; name: string | null; email: string | null; profileImageUrl: string | null; deletedAt: Date | null }>();
  const rows = await tx
    .select({ id: users.id, publicId: users.publicId, name: users.name, email: users.email, profileImageUrl: users.profileImageUrl, deletedAt: users.deletedAt })
    .from(users)
    .where(inArray(users.id, unique));
  return new Map(rows.map((row) => [row.id, row]));
}

/** Loads an active group by public id and the actor's active membership in it. */
export async function requireGroupMembership(tx: Tx, groupPublicId: string, userId: number) {
  const rows = await tx
    .select({ group: groups, role: groupMembers.role })
    .from(groups)
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, userId), isNull(groupMembers.leftAt)))
    .where(and(eq(groups.publicId, groupPublicId), isNull(groups.archivedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) throw notFound("Group not found, or you are not a member.");
  return row;
}

export async function activeMemberIds(tx: Tx, groupId: number) {
  const rows = await tx.select({ userId: groupMembers.userId }).from(groupMembers).where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt)));
  return new Set(rows.map((row) => row.userId));
}

export const defaultNotificationPreferences: NotificationPreferences = {
  pushEnabled: true,
  emailEnabled: true,
  inAppEnabled: true,
  expenseAlerts: true,
  groupAlerts: true,
  settlementAlerts: true,
  reminderAlerts: true,
};

export async function getNotificationPreferences(tx: Tx, userId: number): Promise<NotificationPreferences> {
  const rows = await tx.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId)).limit(1);
  const row = rows[0];
  if (!row) return { ...defaultNotificationPreferences };
  return {
    pushEnabled: row.pushEnabled,
    emailEnabled: row.emailEnabled,
    inAppEnabled: row.inAppEnabled,
    expenseAlerts: row.expenseAlerts,
    groupAlerts: row.groupAlerts,
    settlementAlerts: row.settlementAlerts,
    reminderAlerts: row.reminderAlerts,
  };
}

type NotifyKind = "expense" | "group" | "settlement";
const kindToPreference: Record<NotifyKind, keyof NotificationPreferences> = {
  expense: "expenseAlerts",
  group: "groupAlerts",
  settlement: "settlementAlerts",
};

/** Inserts in-app notifications, skipping people who turned that kind of alert off. */
export async function notify(
  tx: Tx,
  userIds: number[],
  kind: NotifyKind,
  payload: { type: string; title: string; message: string; relatedEntityType?: string; relatedEntityId?: string },
) {
  const recipients = [...new Set(userIds)];
  if (!recipients.length) return;
  const prefs = await tx.select().from(notificationPreferences).where(inArray(notificationPreferences.userId, recipients));
  const prefByUser = new Map(prefs.map((row) => [row.userId, row]));
  const allowed = recipients.filter((userId) => {
    const pref = prefByUser.get(userId);
    if (!pref) return true;
    return pref.inAppEnabled && pref[kindToPreference[kind]];
  });
  if (!allowed.length) return;
  await tx.insert(notifications).values(
    allowed.map((userId) => ({
      publicId: crypto.randomUUID(),
      userId,
      type: payload.type,
      title: payload.title.slice(0, 160),
      message: payload.message,
      relatedEntityType: payload.relatedEntityType ?? null,
      relatedEntityId: payload.relatedEntityId ?? null,
    })),
  );
}

export async function logActivity(
  tx: Tx,
  entry: { actorId: number; groupId: number | null; kind: string; title: string; message: string; relatedEntityType?: string; relatedEntityId?: string },
) {
  await tx.insert(activityLogs).values({
    publicId: crypto.randomUUID(),
    actorId: entry.actorId,
    groupId: entry.groupId,
    kind: entry.kind,
    title: entry.title.slice(0, 160),
    message: entry.message,
    relatedEntityType: entry.relatedEntityType ?? null,
    relatedEntityId: entry.relatedEntityId ?? null,
  });
}

/** "PKR 2,000" / "USD 12.50" — for notification and activity text. */
export function formatPlain(amountMinor: number, currency: string) {
  const whole = amountMinor % 100 === 0;
  return `${currency} ${(amountMinor / 100).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}
