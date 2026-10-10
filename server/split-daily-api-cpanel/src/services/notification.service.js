import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../database/client.js";
import { notifications } from "../models/index.js";
async function getNotificationsForUser(userId) {
  const db = getDb();
  return db.select().from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.deletedAt))).orderBy(desc(notifications.createdAt)).limit(50);
}
async function markNotificationReadForUser(userId, publicId) {
  const db = getDb();
  await db.update(notifications).set({ readAt: /* @__PURE__ */ new Date() }).where(and(eq(notifications.publicId, publicId), eq(notifications.userId, userId), isNull(notifications.deletedAt)));
  return { success: true };
}
async function markAllNotificationsReadForUser(userId) {
  const db = getDb();
  await db.update(notifications).set({ readAt: /* @__PURE__ */ new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt), isNull(notifications.deletedAt)));
  return { success: true };
}
export {
  getNotificationsForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser
};
