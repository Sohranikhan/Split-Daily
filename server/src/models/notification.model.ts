/** In-app notifications, notification preferences, reminders and push devices. */
import { boolean, index, integer, pgTable, primaryKey, text, varchar } from "drizzle-orm/pg-core";
import { publicId, id, ts, createdAt, updatedAt } from "./columns";

export const notifications = pgTable("notifications", {
  id: id(),
  publicId: publicId("publicId"),
  userId: integer("userId").notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  message: text("message").notNull(),
  relatedEntityType: varchar("relatedEntityType", { length: 64 }),
  relatedEntityId: varchar("relatedEntityId", { length: 36 }),
  readAt: ts("readAt"),
  createdAt: createdAt(),
  deletedAt: ts("deletedAt"),
}, (table) => [index("notifications_user_feed_idx").on(table.userId, table.createdAt)]);

export const notificationPreferences = pgTable("notification_preferences", {
  userId: integer("userId").primaryKey(),
  pushEnabled: boolean("pushEnabled").default(true).notNull(),
  emailEnabled: boolean("emailEnabled").default(true).notNull(),
  inAppEnabled: boolean("inAppEnabled").default(true).notNull(),
  expenseAlerts: boolean("expenseAlerts").default(true).notNull(),
  groupAlerts: boolean("groupAlerts").default(true).notNull(),
  friendAlerts: boolean("friendAlerts").default(true).notNull(),
  settlementAlerts: boolean("settlementAlerts").default(true).notNull(),
  reminderAlerts: boolean("reminderAlerts").default(true).notNull(),
  updatedAt: updatedAt(),
});

export const reminders = pgTable("reminders", {
  id: id(),
  publicId: publicId("publicId"),
  createdBy: integer("createdBy").notNull(),
  targetUserId: integer("targetUserId"),
  amountMinor: integer("amountMinor"),
  currency: varchar("currency", { length: 3 }),
  message: text("message").notNull(),
  remindAt: ts("remindAt").notNull(),
  recurrence: varchar("recurrence", { length: 32 }),
  completedAt: ts("completedAt"),
  createdAt: createdAt(),
});

export const devices = pgTable("devices", {
  id: id(),
  publicId: publicId("publicId"),
  userId: integer("userId").notNull(),
  platform: varchar("platform", { length: 32 }).notNull(),
  deviceName: varchar("deviceName", { length: 160 }),
  lastSeenAt: ts("lastSeenAt").defaultNow().notNull(),
});

export const pushTokens = pgTable("push_tokens", {
  id: id(),
  deviceId: integer("deviceId").notNull(),
  token: varchar("token", { length: 512 }).notNull().unique(),
  provider: varchar("provider", { length: 32 }).default("expo").notNull(),
  createdAt: createdAt(),
  revokedAt: ts("revokedAt"),
});
