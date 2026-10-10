import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { activityLogs, groupMembers, groups, notificationPreferences, notifications, users } from "../models/index.js";
const badRequest = (message) => new TRPCError({ code: "BAD_REQUEST", message });
const forbidden = (message) => new TRPCError({ code: "FORBIDDEN", message });
const notFound = (message) => new TRPCError({ code: "NOT_FOUND", message });
const displayName = (user) => user?.name?.trim() || user?.email?.split("@")[0] || "Someone";
async function resolveUserIds(tx, identifiers) {
  const numericIds = identifiers.map(Number).filter(Number.isInteger);
  const publicIds = identifiers.filter((value) => !Number.isInteger(Number(value)));
  if (!identifiers.length) return [];
  const conditions = [
    numericIds.length ? inArray(users.id, numericIds) : void 0,
    publicIds.length ? inArray(users.publicId, publicIds) : void 0
  ].filter(Boolean);
  const rows = await tx.select({ id: users.id, publicId: users.publicId }).from(users).where(or(...conditions));
  const byIdentifier = /* @__PURE__ */ new Map();
  for (const row of rows) {
    byIdentifier.set(String(row.id), row.id);
    byIdentifier.set(row.publicId, row.id);
  }
  const resolved = identifiers.map((identifier) => byIdentifier.get(identifier)).filter((id) => id !== void 0);
  if (resolved.length !== identifiers.length || new Set(resolved).size !== resolved.length) {
    throw badRequest("Every payer and participant must be a valid, unique person.");
  }
  return resolved;
}
async function loadUsers(tx, ids) {
  const unique = [...new Set(ids)];
  if (!unique.length) return /* @__PURE__ */ new Map();
  const rows = await tx.select({ id: users.id, publicId: users.publicId, name: users.name, email: users.email, profileImageUrl: users.profileImageUrl, deletedAt: users.deletedAt }).from(users).where(inArray(users.id, unique));
  return new Map(rows.map((row) => [row.id, row]));
}
async function requireGroupMembership(tx, groupPublicId, userId) {
  const rows = await tx.select({ group: groups, role: groupMembers.role }).from(groups).innerJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, userId), isNull(groupMembers.leftAt))).where(and(eq(groups.publicId, groupPublicId), isNull(groups.archivedAt))).limit(1);
  const row = rows[0];
  if (!row) throw notFound("Group not found, or you are not a member.");
  return row;
}
async function activeMemberIds(tx, groupId) {
  const rows = await tx.select({ userId: groupMembers.userId }).from(groupMembers).where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt)));
  return new Set(rows.map((row) => row.userId));
}
const defaultNotificationPreferences = {
  pushEnabled: true,
  emailEnabled: true,
  inAppEnabled: true,
  expenseAlerts: true,
  groupAlerts: true,
  settlementAlerts: true,
  reminderAlerts: true
};
async function getNotificationPreferences(tx, userId) {
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
    reminderAlerts: row.reminderAlerts
  };
}
const kindToPreference = {
  expense: "expenseAlerts",
  group: "groupAlerts",
  settlement: "settlementAlerts"
};
async function notify(tx, userIds, kind, payload) {
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
      relatedEntityId: payload.relatedEntityId ?? null
    }))
  );
}
async function logActivity(tx, entry) {
  await tx.insert(activityLogs).values({
    publicId: crypto.randomUUID(),
    actorId: entry.actorId,
    groupId: entry.groupId,
    kind: entry.kind,
    title: entry.title.slice(0, 160),
    message: entry.message,
    relatedEntityType: entry.relatedEntityType ?? null,
    relatedEntityId: entry.relatedEntityId ?? null
  });
}
function formatPlain(amountMinor, currency) {
  const whole = amountMinor % 100 === 0;
  return `${currency} ${(amountMinor / 100).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}
export {
  activeMemberIds,
  badRequest,
  defaultNotificationPreferences,
  displayName,
  forbidden,
  formatPlain,
  getNotificationPreferences,
  loadUsers,
  logActivity,
  notFound,
  notify,
  requireGroupMembership,
  resolveUserIds
};
