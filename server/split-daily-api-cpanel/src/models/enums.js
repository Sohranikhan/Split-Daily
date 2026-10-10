import { pgEnum } from "drizzle-orm/pg-core";
const userRole = pgEnum("user_role", ["user", "admin"]);
const groupMemberRole = pgEnum("group_member_role", ["owner", "admin", "member"]);
const friendRequestStatus = pgEnum("friend_request_status", ["pending", "accepted", "rejected", "cancelled"]);
const splitMethodEnum = pgEnum("split_method", ["equal", "exact", "percentage", "shares"]);
const settlementStatus = pgEnum("settlement_status", ["pending", "paid", "confirmed", "cancelled"]);
export {
  friendRequestStatus,
  groupMemberRole,
  settlementStatus,
  splitMethodEnum,
  userRole
};
