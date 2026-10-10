/**
 * Models: the database tables (Drizzle ORM), one file per area.
 * Import from "models" everywhere so the rest of the code doesn't care which file a table lives in.
 */
import type { CurrencyCode, SplitMethod } from "../../../shared/domain";
import type { users } from "./user.model";
import type { groups } from "./group.model";
import type { expenses } from "./expense.model";
import type { settlements } from "./settlement.model";
import type { sessions } from "./user.model";
import type { currencies } from "./currency.model";

export * from "./enums";
export * from "./user.model";
export * from "./currency.model";
export * from "./group.model";
export * from "./friend.model";
export * from "./expense.model";
export * from "./settlement.model";
export * from "./notification.model";
export * from "./activity.model";

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type CurrencyRow = typeof currencies.$inferSelect;
export type StoredSplitMethod = SplitMethod;
export type StoredCurrencyCode = CurrencyCode;
