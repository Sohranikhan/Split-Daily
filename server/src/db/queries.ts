import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { activityLogs, expenses, groupMembers, groups, notifications, type User } from "./schema";
import { groupAccent, toCurrencyCode, type BalanceSummary, type CurrencyCode, type DashboardData, type GroupSummary, type LedgerActivity, type PersonBalance } from "../../../shared/domain";
import { computeUserLedger, toAmounts } from "../services/balance-service";
import { loadUsers, displayName } from "../services/common";
import { getDb } from "./client";

export function safeCurrency(value: string | null | undefined): CurrencyCode {
  return toCurrencyCode(value);
}

export async function getDashboardForUser(user: Pick<User, "id" | "defaultCurrency">): Promise<DashboardData> {
  const db = getDb();
  const userId = user.id;
  const defaultCurrency = toCurrencyCode(user.defaultCurrency);

  const groupRows = await db
    .select({ group: groups })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(and(eq(groupMembers.userId, userId), isNull(groupMembers.leftAt), isNull(groups.archivedAt)))
    .orderBy(desc(groups.updatedAt));
  const groupIds = groupRows.map(({ group }) => group.id);

  const memberRows = groupIds.length ? await db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(and(inArray(groupMembers.groupId, groupIds), isNull(groupMembers.leftAt))) : [];
  const memberCounts = new Map<number, number>();
  for (const member of memberRows) memberCounts.set(member.groupId, (memberCounts.get(member.groupId) ?? 0) + 1);

  const ledger = await computeUserLedger(db, userId);

  const balances: BalanceSummary[] = [...ledger.totals.entries()]
    .map(([currency, t]) => ({ currency, owedToYouMinor: t.owedToYouMinor, youOweMinor: t.youOweMinor, netMinor: t.owedToYouMinor - t.youOweMinor }))
    .sort((a, b) => (a.currency === defaultCurrency ? -1 : b.currency === defaultCurrency ? 1 : Math.abs(b.netMinor) - Math.abs(a.netMinor)));
  const primary = balances.find((b) => b.currency === defaultCurrency) ?? { currency: defaultCurrency, owedToYouMinor: 0, youOweMinor: 0, netMinor: 0 };

  const personTotals = new Map<number, Map<CurrencyCode, number>>();
  for (const [currency, perPerson] of ledger.people) {
    for (const [otherId, amount] of perPerson) {
      if (amount === 0) continue;
      let inner = personTotals.get(otherId);
      if (!inner) personTotals.set(otherId, (inner = new Map()));
      inner.set(currency, amount);
    }
  }
  const people = await loadUsers(db, [...personTotals.keys()]);
  const peopleBalances: PersonBalance[] = [...personTotals.entries()]
    .map(([otherId, amounts]) => {
      const person = people.get(otherId);
      return { userId: person?.publicId ?? String(otherId), name: person?.deletedAt ? "Deleted user" : displayName(person), avatarUrl: person?.profileImageUrl ?? null, balances: toAmounts(amounts) };
    })
    .filter((p) => p.balances.length)
    .sort((a, b) => Math.abs(b.balances[0]!.amountMinor) - Math.abs(a.balances[0]!.amountMinor));

  const groupSummaries: GroupSummary[] = groupRows.map(({ group }) => {
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
      accent: groupAccent(group.category),
    };
  });

  const activityRows = await db
    .select({ activity: activityLogs })
    .from(activityLogs)
    .where(groupIds.length ? or(eq(activityLogs.actorId, userId), inArray(activityLogs.groupId, groupIds)) : eq(activityLogs.actorId, userId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(20);
  const actors = await loadUsers(db, activityRows.map(({ activity }) => activity.actorId));
  const relatedExpenseIds = activityRows.map(({ activity }) => activity.relatedEntityType === "expense" ? activity.relatedEntityId : null).filter((id): id is string => Boolean(id));
  const expenseRows = relatedExpenseIds.length ? await db.select({ publicId: expenses.publicId, amountMinor: expenses.amountMinor, currency: expenses.currency, deletedAt: expenses.deletedAt }).from(expenses).where(inArray(expenses.publicId, relatedExpenseIds)) : [];
  const expenseByPublicId = new Map(expenseRows.map((e) => [e.publicId, e]));

  const activity: LedgerActivity[] = activityRows.map(({ activity: entry }) => {
    const actorName = entry.actorId === userId ? "You" : displayName(actors.get(entry.actorId));
    const expense = entry.relatedEntityType === "expense" && entry.relatedEntityId ? expenseByPublicId.get(entry.relatedEntityId) : undefined;
    return {
      id: entry.publicId,
      kind: entry.kind === "settlement" ? "settlement" : entry.kind === "group" ? "group" : "expense",
      title: entry.title,
      subtitle: `${actorName} · ${entry.message}`,
      amountMinor: expense && !expense.deletedAt ? expense.amountMinor : undefined,
      currency: expense && !expense.deletedAt ? toCurrencyCode(expense.currency) : undefined,
      createdAt: entry.createdAt.toISOString(),
      relatedId: expense?.deletedAt ? null : entry.relatedEntityId,
      relatedType: entry.relatedEntityType,
    };
  });

  return { balance: primary, balances, people: peopleBalances, groups: groupSummaries, activity };
}

export async function getNotificationsForUser(userId: number) {
  const db = getDb();
  return db.select().from(notifications).where(and(eq(notifications.userId, userId), isNull(notifications.deletedAt))).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function markNotificationReadForUser(userId: number, publicId: string) {
  const db = getDb();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.publicId, publicId), eq(notifications.userId, userId), isNull(notifications.deletedAt)));
  return { success: true as const };
}

export async function markAllNotificationsReadForUser(userId: number) {
  const db = getDb();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt), isNull(notifications.deletedAt)));
  return { success: true as const };
}
