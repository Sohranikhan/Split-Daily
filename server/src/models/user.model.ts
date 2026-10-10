/** People, their linked sign-in providers (Google) and server-side sessions. */
import { boolean, index, integer, pgTable, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { publicId, id, ts, createdAt, updatedAt } from "./columns";
import { userRole } from "./enums";

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
