import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { activityLogs, expenses, groupMembers, groups } from "../models/index.js";
import { groupAccent, toCurrencyCode } from "../../shared/domain.js";
import { computeUserLedger, toAmounts } from "./balance.service.js";
import { loadUsers, displayName } from "./helpers.js";
import { getDb } from "../database/client.js";
function safeCurrency(value) {
  return toCurrencyCode(value);
}
async function getDashboardForUser(user) {
  const db = getDb();
  const userId = user.id;
  const defaultCurrency = toCurrencyCode(user.defaultCurrency);
  const groupRows = await db.select({ group: groups }).from(groupMembers).innerJoin(groups, eq(groups.id, groupMembers.groupId)).where(and(eq(groupMembers.userId, userId), isNull(groupMembers.leftAt), isNull(groups.archivedAt))).orderBy(desc(groups.updatedAt));
  const groupIds = groupRows.map(({ group }) => group.id);
  const memberRows = groupIds.length ? await db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(and(inArray(groupMembers.groupId, groupIds), isNull(groupMembers.leftAt))) : [];
  const memberCounts = /* @__PURE__ */ new Map();
  for (const member of memberRows) memberCounts.set(member.groupId, (memberCounts.get(member.groupId) ?? 0) + 1);
  const ledger = await computeUserLedger(db, userId);
  const balances = [...ledger.totals.entries()].map(([currency, t]) => ({ currency, owedToYouMinor: t.owedToYouMinor, youOweMinor: t.youOweMinor, netMinor: t.owedToYouMinor - t.youOweMinor })).sort((a, b) => a.currency === defaultCurrency ? -1 : b.currency === defaultCurrency ? 1 : Math.abs(b.netMinor) - Math.abs(a.netMinor));
  const primary = balances.find((b) => b.currency === defaultCurrency) ?? { currency: defaultCurrency, owedToYouMinor: 0, youOweMinor: 0, netMinor: 0 };
  const personTotals = /* @__PURE__ */ new Map();
  for (const [currency, perPerson] of ledger.people) {
    for (const [otherId, amount] of perPerson) {
      if (amount === 0) continue;
      let inner = personTotals.get(otherId);
      if (!inner) personTotals.set(otherId, inner = /* @__PURE__ */ new Map());
      inner.set(currency, amount);
    }
  }
  const people = await loadUsers(db, [...personTotals.keys()]);
  const peopleBalances = [...personTotals.entries()].map(([otherId, amounts]) => {
    const person = people.get(otherId);
    return { userId: person?.publicId ?? String(otherId), name: person?.deletedAt ? "Deleted user" : displayName(person), avatarUrl: person?.profileImageUrl ?? null, balances: toAmounts(amounts) };
  }).filter((p) => p.balances.length).sort((a, b) => Math.abs(b.balances[0].amountMinor) - Math.abs(a.balances[0].amountMinor));
  const groupSummaries = groupRows.map(({ group }) => {
    const currency = toCurrencyCode(group.currency);
    const amounts = toAmounts(ledger.groupNets.get(group.id));
    const main = amounts.find((a) => a.currency === currency) ?? amounts[0];
    return {
      id: group.publicId,
      name: group.name,
      category: group.category,
      memberCount: memberCounts.get(group.id) ?? 0,
      balanceMinor: main?.amountMinor ?? 0,
      currency: main?.currency ?? currency,
      balances: amounts,
      accent: groupAccent(group.category)
    };
  });
  const activityRows = await db.select({ activity: activityLogs }).from(activityLogs).where(groupIds.length ? or(eq(activityLogs.actorId, userId), inArray(activityLogs.groupId, groupIds)) : eq(activityLogs.actorId, userId)).orderBy(desc(activityLogs.createdAt)).limit(20);
  const actors = await loadUsers(db, activityRows.map(({ activity: activity2 }) => activity2.actorId));
  const relatedExpenseIds = activityRows.map(({ activity: activity2 }) => activity2.relatedEntityType === "expense" ? activity2.relatedEntityId : null).filter((id) => Boolean(id));
  const expenseRows = relatedExpenseIds.length ? await db.select({ publicId: expenses.publicId, amountMinor: expenses.amountMinor, currency: expenses.currency, deletedAt: expenses.deletedAt }).from(expenses).where(inArray(expenses.publicId, relatedExpenseIds)) : [];
  const expenseByPublicId = new Map(expenseRows.map((e) => [e.publicId, e]));
  const activity = activityRows.map(({ activity: entry }) => {
    const actorName = entry.actorId === userId ? "You" : displayName(actors.get(entry.actorId));
    const expense = entry.relatedEntityType === "expense" && entry.relatedEntityId ? expenseByPublicId.get(entry.relatedEntityId) : void 0;
    return {
      id: entry.publicId,
      kind: entry.kind === "settlement" ? "settlement" : entry.kind === "group" ? "group" : "expense",
      title: entry.title,
      subtitle: `${actorName} \xB7 ${entry.message}`,
      amountMinor: expense && !expense.deletedAt ? expense.amountMinor : void 0,
      currency: expense && !expense.deletedAt ? toCurrencyCode(expense.currency) : void 0,
      createdAt: entry.createdAt.toISOString(),
      relatedId: expense?.deletedAt ? null : entry.relatedEntityId,
      relatedType: entry.relatedEntityType
    };
  });
  return { balance: primary, balances, people: peopleBalances, groups: groupSummaries, activity };
}
export {
  getDashboardForUser,
  safeCurrency
};
