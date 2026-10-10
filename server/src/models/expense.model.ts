/** Expenses, who paid, how they were split, receipts and recurring templates. */
import { index, integer, pgTable, primaryKey, text, varchar } from "drizzle-orm/pg-core";
import { publicId, id, ts, createdAt, updatedAt } from "./columns";
import { splitMethodEnum } from "./enums";

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
