import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import type { CurrencyCode, SplitMethod } from "../../../shared/domain";

const publicId = (name: string) => varchar(name, { length: 36 }).notNull().unique().$defaultFn(() => crypto.randomUUID());
const id = () => integer("id").primaryKey().generatedAlwaysAsIdentity();
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("createdAt").defaultNow().notNull();
const updatedAt = () => ts("updatedAt").defaultNow().notNull().$onUpdate(() => new Date());

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const groupMemberRole = pgEnum("group_member_role", ["owner", "admin", "member"]);
export const friendRequestStatus = pgEnum("friend_request_status", ["pending", "accepted", "rejected", "cancelled"]);
export const splitMethodEnum = pgEnum("split_method", ["equal", "exact", "percentage", "shares"]);
export const settlementStatus = pgEnum("settlement_status", ["pending", "paid", "confirmed", "cancelled"]);

export const users = pgTable("users", {
  id: id(),
  publicId: publicId("publicId"),
  name: varchar("name", { length: 160 }),
  email: varchar("email", { length: 320 }).unique(),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  profileImageUrl: text("profileImageUrl"),
  phone: varchar("phone", { length: 32 }),
  defaultCurrency: varchar("defaultCurrency", { length: 3 }).default("USD").notNull(),
  displayCurrency: varchar("displayCurrency", { length: 3 }).default("USD").notNull(),
  country: varchar("country", { length: 2 }),
  timezone: varchar("timezone", { length: 64 }),
  language: varchar("language", { length: 16 }).default("en").notNull(),
  role: userRole("role").default("user").notNull(),
  notificationPreferences: text("notificationPreferences"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  lastSignedIn: ts("lastSignedIn").defaultNow().notNull(),
  deletedAt: ts("deletedAt"),
});

/** External identity providers linked to a user (Google today; Apple etc. can be added the same way). */
export const accounts = pgTable("accounts", {
  id: id(),
  publicId: publicId("publicId"),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider", { length: 64 }).notNull(),
  providerAccountId: varchar("providerAccountId", { length: 191 }).notNull(),
  email: varchar("email", { length: 320 }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("accounts_provider_idx").on(table.provider, table.providerAccountId),
  index("accounts_user_idx").on(table.userId),
]);

/** Server-side session records. The signed token only carries the session id, so logout really revokes access. */
export const sessions = pgTable("sessions", {
  id: id(),
  publicId: publicId("publicId"),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  userAgent: varchar("userAgent", { length: 512 }),
  ipAddress: varchar("ipAddress", { length: 64 }),
  expiresAt: ts("expiresAt").notNull(),
  createdAt: createdAt(),
  lastUsedAt: ts("lastUsedAt").defaultNow().notNull(),
  revokedAt: ts("revokedAt"),
}, (table) => [index("sessions_user_idx").on(table.userId)]);

export const currencies = pgTable("currencies", {
  code: varchar("code", { length: 3 }).primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  symbol: varchar("symbol", { length: 8 }).notNull(),
  minorUnit: integer("minorUnit").default(2).notNull(),
  active: boolean("active").default(true).notNull(),
});

export const groups = pgTable("groups", {
  id: id(),
  publicId: publicId("publicId"),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  imageUrl: text("imageUrl"),
  category: varchar("category", { length: 64 }).default("Other").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  archivedAt: ts("archivedAt"),
}, (table) => [
  index("groups_owner_idx").on(table.createdBy),
  index("groups_archived_idx").on(table.archivedAt),
]);

export const groupMembers = pgTable("group_members", {
  groupId: integer("groupId").notNull(),
  userId: integer("userId").notNull(),
  role: groupMemberRole("role").default("member").notNull(),
  joinedAt: ts("joinedAt").defaultNow().notNull(),
  leftAt: ts("leftAt"),
}, (table) => [
  primaryKey({ columns: [table.groupId, table.userId] }),
  index("group_members_user_idx").on(table.userId),
]);

export const groupInvitations = pgTable("group_invitations", {
  id: id(),
  publicId: publicId("publicId"),
  groupId: integer("groupId").notNull(),
  inviterId: integer("inviterId").notNull(),
  inviteeEmail: varchar("inviteeEmail", { length: 320 }),
  code: varchar("code", { length: 32 }).notNull().unique(),
  expiresAt: ts("expiresAt").notNull(),
  acceptedAt: ts("acceptedAt"),
  createdAt: createdAt(),
}, (table) => [index("group_invitations_group_idx").on(table.groupId)]);

export const friendships = pgTable("friendships", {
  id: id(),
  publicId: publicId("publicId"),
  userAId: integer("userAId").notNull(),
  userBId: integer("userBId").notNull(),
  createdAt: createdAt(),
  removedAt: ts("removedAt"),
}, (table) => [uniqueIndex("friendships_pair_idx").on(table.userAId, table.userBId)]);

export const friendRequests = pgTable("friend_requests", {
  id: id(),
  publicId: publicId("publicId"),
  senderId: integer("senderId").notNull(),
  receiverId: integer("receiverId").notNull(),
  status: friendRequestStatus("status").default("pending").notNull(),
  createdAt: createdAt(),
  respondedAt: ts("respondedAt"),
}, (table) => [index("friend_requests_receiver_idx").on(table.receiverId, table.status)]);

export const expenses = pgTable("expenses", {
  id: id(),
  publicId: publicId("publicId"),
  groupId: integer("groupId"),
  createdBy: integer("createdBy").notNull(),
  description: varchar("description", { length: 160 }).notNull(),
  amountMinor: integer("amountMinor").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  originalAmountMinor: integer("originalAmountMinor").notNull(),
  originalCurrency: varchar("originalCurrency", { length: 3 }).notNull(),
  exchangeRate: varchar("exchangeRate", { length: 32 }),
  category: varchar("category", { length: 64 }).default("Other").notNull(),
  splitMethod: splitMethodEnum("splitMethod").notNull(),
  note: text("note"),
  receiptCount: integer("receiptCount").default(0).notNull(),
  occurredAt: ts("occurredAt").defaultNow().notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: ts("deletedAt"),
}, (table) => [
  index("expenses_group_idx").on(table.groupId, table.occurredAt),
  index("expenses_creator_idx").on(table.createdBy, table.occurredAt),
]);

export const expenseParticipants = pgTable("expense_participants", {
  expenseId: integer("expenseId").notNull(),
  userId: integer("userId").notNull(),
  value: varchar("value", { length: 32 }).notNull(),
  amountMinor: integer("amountMinor").notNull(),
}, (table) => [
  primaryKey({ columns: [table.expenseId, table.userId] }),
  index("expense_participants_user_idx").on(table.userId),
]);

export const expensePayers = pgTable("expense_payers", {
  expenseId: integer("expenseId").notNull(),
  userId: integer("userId").notNull(),
  amountMinor: integer("amountMinor").notNull(),
}, (table) => [
  primaryKey({ columns: [table.expenseId, table.userId] }),
  index("expense_payers_user_idx").on(table.userId),
]);

export const settlements = pgTable("settlements", {
  id: id(),
  publicId: publicId("publicId"),
  groupId: integer("groupId"),
  payerId: integer("payerId").notNull(),
  receiverId: integer("receiverId").notNull(),
  amountMinor: integer("amountMinor").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 64 }).default("Other").notNull(),
  note: text("note"),
  status: settlementStatus("status").default("pending").notNull(),
  settledAt: ts("settledAt"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("settlements_payer_idx").on(table.payerId, table.status),
  index("settlements_receiver_idx").on(table.receiverId, table.status),
]);

export const exchangeRates = pgTable("exchange_rates", {
  id: id(),
  baseCurrency: varchar("baseCurrency", { length: 3 }).notNull(),
  quoteCurrency: varchar("quoteCurrency", { length: 3 }).notNull(),
  rate: varchar("rate", { length: 32 }).notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  capturedAt: ts("capturedAt").defaultNow().notNull(),
}, (table) => [index("exchange_rates_lookup_idx").on(table.baseCurrency, table.quoteCurrency, table.capturedAt)]);

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

export const recurringExpenses = pgTable("recurring_expenses", {
  id: id(),
  publicId: publicId("publicId"),
  createdBy: integer("createdBy").notNull(),
  groupId: integer("groupId"),
  description: varchar("description", { length: 160 }).notNull(),
  amountMinor: integer("amountMinor").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  recurrence: varchar("recurrence", { length: 32 }).notNull(),
  startDate: ts("startDate").notNull(),
  endDate: ts("endDate"),
  nextRunAt: ts("nextRunAt").notNull(),
  pausedAt: ts("pausedAt"),
  cancelledAt: ts("cancelledAt"),
  createdAt: createdAt(),
});

export const receipts = pgTable("receipts", {
  id: id(),
  publicId: publicId("publicId"),
  expenseId: integer("expenseId").notNull(),
  uploadedBy: integer("uploadedBy").notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  stableUrl: varchar("stableUrl", { length: 1024 }).notNull(),
  contentType: varchar("contentType", { length: 128 }).notNull(),
  sizeBytes: integer("sizeBytes").notNull(),
  createdAt: createdAt(),
  deletedAt: ts("deletedAt"),
});

export const activityLogs = pgTable("activity_logs", {
  id: id(),
  publicId: publicId("publicId"),
  actorId: integer("actorId").notNull(),
  groupId: integer("groupId"),
  kind: varchar("kind", { length: 64 }).notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  message: text("message").notNull(),
  relatedEntityType: varchar("relatedEntityType", { length: 64 }),
  relatedEntityId: varchar("relatedEntityId", { length: 36 }),
  createdAt: createdAt(),
}, (table) => [
  index("activity_group_feed_idx").on(table.groupId, table.createdAt),
  index("activity_actor_idx").on(table.actorId, table.createdAt),
]);

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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type CurrencyRow = typeof currencies.$inferSelect;
export type StoredSplitMethod = SplitMethod;
export type StoredCurrencyCode = CurrencyCode;
