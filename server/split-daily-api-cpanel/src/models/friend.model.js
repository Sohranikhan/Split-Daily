import { index, integer, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { publicId, id, ts, createdAt } from "./columns.js";
import { friendRequestStatus } from "./enums.js";
const friendships = pgTable("friendships", {
  id: id(),
  publicId: publicId("publicId"),
  userAId: integer("userAId").notNull(),
  userBId: integer("userBId").notNull(),
  createdAt: createdAt(),
  removedAt: ts("removedAt")
}, (table) => [uniqueIndex("friendships_pair_idx").on(table.userAId, table.userBId)]);
const friendRequests = pgTable("friend_requests", {
  id: id(),
  publicId: publicId("publicId"),
  senderId: integer("senderId").notNull(),
  receiverId: integer("receiverId").notNull(),
  status: friendRequestStatus("status").default("pending").notNull(),
  createdAt: createdAt(),
  respondedAt: ts("respondedAt")
}, (table) => [index("friend_requests_receiver_idx").on(table.receiverId, table.status)]);
export {
  friendRequests,
  friendships
};
