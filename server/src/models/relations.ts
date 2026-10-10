import { relations } from "drizzle-orm";
import { expenses, expenseParticipants, expensePayers, groupMembers, groups, users } from ".";

export const usersRelations = relations(users, ({ many }) => ({
  groups: many(groupMembers),
  expensesCreated: many(expenses),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  expenses: many(expenses),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, { fields: [groupMembers.groupId], references: [groups.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  group: one(groups, { fields: [expenses.groupId], references: [groups.id] }),
  creator: one(users, { fields: [expenses.createdBy], references: [users.id] }),
  participants: many(expenseParticipants),
  payers: many(expensePayers),
}));

export const expenseParticipantsRelations = relations(expenseParticipants, ({ one }) => ({
  expense: one(expenses, { fields: [expenseParticipants.expenseId], references: [expenses.id] }),
  user: one(users, { fields: [expenseParticipants.userId], references: [users.id] }),
}));

export const expensePayersRelations = relations(expensePayers, ({ one }) => ({
  expense: one(expenses, { fields: [expensePayers.expenseId], references: [expenses.id] }),
  user: one(users, { fields: [expensePayers.userId], references: [users.id] }),
}));
