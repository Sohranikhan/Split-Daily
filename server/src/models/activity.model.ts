/** The activity feed: who did what, in which group. */
import { index, integer, pgTable, text, varchar } from "drizzle-orm/pg-core";
import { publicId, id, createdAt } from "./columns";

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
