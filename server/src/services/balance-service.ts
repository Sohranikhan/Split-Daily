import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { expenseParticipants, expensePayers, expenses, settlements } from "../db/schema";
import { calculateDebts } from "../../../shared/finance/split-engine";
import { toCurrencyCode, type CurrencyAmount, type CurrencyCode, type Debt } from "../../../shared/domain";
import type { Tx } from "./common";

/** Settlements in these states move money; "pending" and "cancelled" don't. */
const EFFECTIVE_SETTLEMENT = ["paid", "confirmed"] as const;

type Lines = { payers: Map<number, Array<{ userId: number; amountMinor: number }>>; participants: Map<number, Array<{ userId: number; amountMinor: number }>> };

export async function loadExpenseLines(tx: Tx, expenseIds: number[]): Promise<Lines> {
  const payers = new Map<number, Array<{ userId: number; amountMinor: number }>>();
  const participants = new Map<number, Array<{ userId: number; amountMinor: number }>>();
  if (!expenseIds.length) return { payers, participants };
  const [payerRows, participantRows] = await Promise.all([
    tx.select().from(expensePayers).where(inArray(expensePayers.expenseId, expenseIds)),
    tx.select().from(expenseParticipants).where(inArray(expenseParticipants.expenseId, expenseIds)),
  ]);
  for (const row of payerRows) payers.set(row.expenseId, [...(payers.get(row.expenseId) ?? []), { userId: row.userId, amountMinor: row.amountMinor }]);
  for (const row of participantRows) participants.set(row.expenseId, [...(participants.get(row.expenseId) ?? []), { userId: row.userId, amountMinor: row.amountMinor }]);
  return { payers, participants };
}

function bump<K>(map: Map<K, number>, key: K, delta: number) {
  map.set(key, (map.get(key) ?? 0) + delta);
}

function nested<K1, K2>(map: Map<K1, Map<K2, number>>, key: K1) {
  let inner = map.get(key);
  if (!inner) {
    inner = new Map<K2, number>();
    map.set(key, inner);
  }
  return inner;
}

export function toAmounts(map: Map<CurrencyCode, number> | undefined): CurrencyAmount[] {
  if (!map) return [];
  return [...map.entries()].filter(([, amount]) => amount !== 0).map(([currency, amountMinor]) => ({ currency, amountMinor })).sort((a, b) => Math.abs(b.amountMinor) - Math.abs(a.amountMinor));
}

/** Converts per-person net positions into the fewest "A pays B" transfers. */
export function netsToDebts(nets: Map<string, number>, currency: CurrencyCode): Debt[] {
  const creditors = [...nets.entries()].filter(([, amount]) => amount > 0).map(([userId, amountMinor]) => ({ userId, amountMinor }));
  const debtors = [...nets.entries()].filter(([, amount]) => amount < 0).map(([userId, amount]) => ({ userId, amountMinor: -amount }));
  return calculateDebts(creditors, debtors, currency);
}

/**
 * Everything one user's balances depend on:
 * - `people`: per currency, how much each other person owes them (negative = they owe that person)
 * - `groups`: per group, their net position in each currency
 * - `totals`: per currency, their overall net
 */
export async function computeUserLedger(tx: Tx, userId: number) {
  const involved = await tx
    .selectDistinct({ id: expenses.id, groupId: expenses.groupId, currency: expenses.currency })
    .from(expenses)
    .leftJoin(expenseParticipants, eq(expenseParticipants.expenseId, expenses.id))
    .leftJoin(expensePayers, eq(expensePayers.expenseId, expenses.id))
    .where(and(isNull(expenses.deletedAt), or(eq(expenseParticipants.userId, userId), eq(expensePayers.userId, userId))));
  const lines = await loadExpenseLines(tx, involved.map((row) => row.id));

  const people = new Map<CurrencyCode, Map<number, number>>();
  const groupNets = new Map<number, Map<CurrencyCode, number>>();

  for (const expense of involved) {
    const currency = toCurrencyCode(expense.currency);
    const payers = lines.payers.get(expense.id) ?? [];
    const shares = lines.participants.get(expense.id) ?? [];
    const myNet = payers.filter((p) => p.userId === userId).reduce((s, p) => s + p.amountMinor, 0) - shares.filter((p) => p.userId === userId).reduce((s, p) => s + p.amountMinor, 0);
    if (expense.groupId) bump(nested(groupNets, expense.groupId), currency, myNet);
    const debts = calculateDebts(
      payers.map((p) => ({ userId: String(p.userId), amountMinor: p.amountMinor })),
      shares.map((p) => ({ userId: String(p.userId), amountMinor: p.amountMinor })),
      currency,
    );
    const perPerson = nested(people, currency);
    for (const debt of debts) {
      if (debt.toId === String(userId)) bump(perPerson, Number(debt.fromId), debt.amountMinor);
      if (debt.fromId === String(userId)) bump(perPerson, Number(debt.toId), -debt.amountMinor);
    }
  }

  const settlementRows = await tx
    .select()
    .from(settlements)
    .where(and(or(eq(settlements.payerId, userId), eq(settlements.receiverId, userId)), inArray(settlements.status, [...EFFECTIVE_SETTLEMENT])));
  for (const settlement of settlementRows) {
    const currency = toCurrencyCode(settlement.currency);
    const perPerson = nested(people, currency);
    if (settlement.payerId === userId) {
      // I paid them: they owe me more / I owe them less.
      bump(perPerson, settlement.receiverId, settlement.amountMinor);
      if (settlement.groupId) bump(nested(groupNets, settlement.groupId), currency, settlement.amountMinor);
    } else {
      bump(perPerson, settlement.payerId, -settlement.amountMinor);
      if (settlement.groupId) bump(nested(groupNets, settlement.groupId), currency, -settlement.amountMinor);
    }
  }

  const totals = new Map<CurrencyCode, { owedToYouMinor: number; youOweMinor: number }>();
  for (const [currency, perPerson] of people) {
    const total = { owedToYouMinor: 0, youOweMinor: 0 };
    for (const amount of perPerson.values()) {
      if (amount > 0) total.owedToYouMinor += amount;
      if (amount < 0) total.youOweMinor += -amount;
    }
    if (total.owedToYouMinor || total.youOweMinor) totals.set(currency, total);
  }
  return { people, groupNets, totals };
}

/** Each active member's net position inside one group, plus the simplest way to settle it. */
export async function computeGroupLedger(tx: Tx, groupId: number) {
  const groupExpenses = await tx.select({ id: expenses.id, currency: expenses.currency }).from(expenses).where(and(eq(expenses.groupId, groupId), isNull(expenses.deletedAt)));
  const lines = await loadExpenseLines(tx, groupExpenses.map((row) => row.id));
  const nets = new Map<CurrencyCode, Map<string, number>>();
  for (const expense of groupExpenses) {
    const perUser = nested(nets, toCurrencyCode(expense.currency));
    for (const payer of lines.payers.get(expense.id) ?? []) bump(perUser, String(payer.userId), payer.amountMinor);
    for (const share of lines.participants.get(expense.id) ?? []) bump(perUser, String(share.userId), -share.amountMinor);
  }
  const groupSettlements = await tx.select().from(settlements).where(and(eq(settlements.groupId, groupId), inArray(settlements.status, [...EFFECTIVE_SETTLEMENT])));
  for (const settlement of groupSettlements) {
    const perUser = nested(nets, toCurrencyCode(settlement.currency));
    bump(perUser, String(settlement.payerId), settlement.amountMinor);
    bump(perUser, String(settlement.receiverId), -settlement.amountMinor);
  }
  const debts: Debt[] = [];
  for (const [currency, perUser] of nets) debts.push(...netsToDebts(perUser, currency));
  const memberNets = new Map<number, Map<CurrencyCode, number>>();
  for (const [currency, perUser] of nets) {
    for (const [userId, amount] of perUser) if (amount !== 0) nested(memberNets, Number(userId)).set(currency, amount);
  }
  return { memberNets, debts };
}
