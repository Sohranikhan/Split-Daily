/** Postgres enum types used by the models. */
import { pgEnum } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin"]);

export const groupMemberRole = pgEnum("group_member_role", ["owner", "admin", "member"]);

export const friendRequestStatus = pgEnum("friend_request_status", ["pending", "accepted", "rejected", "cancelled"]);

export const splitMethodEnum = pgEnum("split_method", ["equal", "exact", "percentage", "shares"]);

export const settlementStatus = pgEnum("settlement_status", ["pending", "paid", "confirmed", "cancelled"]);
