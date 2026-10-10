/** Groups, their members and pending invitations. */
import { index, integer, pgTable, primaryKey, text, varchar } from "drizzle-orm/pg-core";
import { publicId, id, ts, createdAt, updatedAt } from "./columns";
import { groupMemberRole } from "./enums";

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
