import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../database/client";
import { notifications } from "../models";

/** In-app notifications shown in the Activity tab. (Creating them lives in services/helpers.ts → notify.) */
export async function getNotificationsForUser(userId: number) {
  const db = getDb();
  return db.select().from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.deletedAt))).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function markNotificationReadForUser(userId: number, publicId: string) {
  const db = getDb();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.publicId, publicId), eq(notifications.userId, userId), isNull(notifications.deletedAt)));
  return { success: true as const };
}

export async function markAllNotificationsReadForUser(userId: number) {
  const db = getDb();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt), isNull(notifications.deletedAt)));
  return { success: true as const };
}
