/** Payments between two people that settle balances. */
import { index, integer, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { publicId, id, ts, createdAt, updatedAt } from "./columns";
import { settlementStatus } from "./enums";

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
