import { and, asc, eq, isNull } from "drizzle-orm";
import { accounts, groupMembers, notificationPreferences, sessions, users } from "../models/index.js";
import { toCurrencyCode } from "../../shared/domain.js";
import { getDb } from "../database/client.js";
import { badRequest, defaultNotificationPreferences, getNotificationPreferences } from "./helpers.js";
async function getSettingsForUser(user) {
  const db = getDb();
  return {
    name: user.name,
    email: user.email,
    avatarUrl: user.profileImageUrl,
    defaultCurrency: toCurrencyCode(user.defaultCurrency),
    notifications: await getNotificationPreferences(db, user.id),
    memberSince: user.createdAt.toISOString()
  };
}
async function updateProfileForUser(userId, input) {
  const db = getDb();
  const patch = {};
  if (input.name !== void 0) patch.name = input.name;
  if (input.defaultCurrency !== void 0) {
    patch.defaultCurrency = input.defaultCurrency;
    patch.displayCurrency = input.defaultCurrency;
  }
  if (!Object.keys(patch).length) throw badRequest("Nothing to update.");
  const updated = await db.update(users).set(patch).where(eq(users.id, userId)).returning();
  return { name: updated[0].name, defaultCurrency: toCurrencyCode(updated[0].defaultCurrency) };
}
async function updateNotificationPreferencesForUser(userId, input) {
  const db = getDb();
  const current = await getNotificationPreferences(db, userId);
  const next = { ...defaultNotificationPreferences, ...current, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== void 0)) };
  await db.insert(notificationPreferences).values({ userId, ...next }).onConflictDoUpdate({ target: notificationPreferences.userId, set: next });
  return next;
}
async function deleteAccountForUser(userId) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const now = /* @__PURE__ */ new Date();
    await tx.update(users).set({ name: "Deleted user", email: null, emailVerified: false, profileImageUrl: null, phone: null, deletedAt: now }).where(eq(users.id, userId));
    await tx.delete(accounts).where(eq(accounts.userId, userId));
    await tx.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    const owned = await tx.select({ groupId: groupMembers.groupId }).from(groupMembers).where(and(eq(groupMembers.userId, userId), eq(groupMembers.role, "owner"), isNull(groupMembers.leftAt)));
    await tx.update(groupMembers).set({ leftAt: now }).where(and(eq(groupMembers.userId, userId), isNull(groupMembers.leftAt)));
    for (const { groupId } of owned) {
      const next = (await tx.select({ userId: groupMembers.userId }).from(groupMembers).where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt))).orderBy(asc(groupMembers.joinedAt)).limit(1))[0];
      if (next) await tx.update(groupMembers).set({ role: "owner" }).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, next.userId)));
    }
    await tx.delete(notificationPreferences).where(eq(notificationPreferences.userId, userId));
  });
  return { success: true };
}
export {
  deleteAccountForUser,
  getSettingsForUser,
  updateNotificationPreferencesForUser,
  updateProfileForUser
};
