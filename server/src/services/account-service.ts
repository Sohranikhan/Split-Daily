import { and, asc, eq, isNull } from "drizzle-orm";
import { accounts, groupMembers, notificationPreferences, sessions, users, type User } from "../db/schema";
import { toCurrencyCode, type NotificationPreferences, type UpdateProfileInput } from "../../../shared/domain";
import { getDb } from "../db/client";
import { badRequest, defaultNotificationPreferences, getNotificationPreferences } from "./common";

export async function getSettingsForUser(user: User) {
  const db = getDb();
  return {
    name: user.name,
    email: user.email,
    avatarUrl: user.profileImageUrl,
    defaultCurrency: toCurrencyCode(user.defaultCurrency),
    notifications: await getNotificationPreferences(db, user.id),
    memberSince: user.createdAt.toISOString(),
  };
}

export async function updateProfileForUser(userId: number, input: UpdateProfileInput) {
  const db = getDb();
  const patch: Partial<typeof users.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.defaultCurrency !== undefined) {
    patch.defaultCurrency = input.defaultCurrency;
    patch.displayCurrency = input.defaultCurrency;
  }
  if (!Object.keys(patch).length) throw badRequest("Nothing to update.");
  const updated = await db.update(users).set(patch).where(eq(users.id, userId)).returning();
  return { name: updated[0]!.name, defaultCurrency: toCurrencyCode(updated[0]!.defaultCurrency) };
}

export async function updateNotificationPreferencesForUser(userId: number, input: Partial<NotificationPreferences>) {
  const db = getDb();
  const current = await getNotificationPreferences(db, userId);
  const next = { ...defaultNotificationPreferences, ...current, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) };
  await db.insert(notificationPreferences).values({ userId, ...next }).onConflictDoUpdate({ target: notificationPreferences.userId, set: next });
  return next;
}

/**
 * Deletes the account: personal details are erased, sign-in links and sessions are removed and the
 * user leaves every group. Expenses they were part of stay (shown as "Deleted user") so other
 * people's balances remain correct. Signing in again with Google creates a brand-new account.
 */
export async function deleteAccountForUser(userId: number) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const now = new Date();
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
  return { success: true as const };
}
