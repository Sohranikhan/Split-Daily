import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { expenseParticipants, expensePayers, expenses, groupMembers, groups } from "../models/index.js";
import { calculateDebts, calculateSplit, SplitValidationError } from "../../shared/finance/split-engine.js";
import { toCurrencyCode } from "../../shared/domain.js";
import { getDb } from "../database/client.js";
import { loadExpenseLines } from "./balance.service.js";
import { activeMemberIds, badRequest, displayName, forbidden, formatPlain, loadUsers, logActivity, notFound, notify, resolveUserIds } from "./helpers.js";
async function prepareExpense(tx, actorId, input, alreadyOnExpense = /* @__PURE__ */ new Set()) {
  const participantIds = await resolveUserIds(tx, input.participantIds);
  const payerIds = await resolveUserIds(tx, input.payerIds);
  let groupId = null;
  if (input.groupId) {
    const groupRows = await tx.select({ id: groups.id }).from(groups).where(and(eq(groups.publicId, input.groupId), isNull(groups.archivedAt))).limit(1);
    groupId = groupRows[0]?.id ?? null;
    if (!groupId) throw notFound("That group could not be found.");
    const memberIds = await activeMemberIds(tx, groupId);
    if (!memberIds.has(actorId)) throw forbidden("You are not a member of that group.");
    if ([...participantIds, ...payerIds].some((id) => !memberIds.has(id) && !alreadyOnExpense.has(id))) {
      throw badRequest("Everyone on a group expense must be a member of the group.");
    }
  }
  const idFor = /* @__PURE__ */ new Map();
  input.participantIds.forEach((identifier, index) => idFor.set(identifier, participantIds[index]));
  input.payerIds.forEach((identifier, index) => idFor.set(identifier, payerIds[index]));
  const values = {};
  for (const [identifier, value] of Object.entries(input.values)) {
    const resolved = idFor.get(identifier);
    if (resolved !== void 0) values[String(resolved)] = value;
  }
  const payerInput = {};
  for (const [identifier, value] of Object.entries(input.payerAmounts)) {
    const resolved = idFor.get(identifier);
    if (resolved !== void 0) payerInput[String(resolved)] = value;
  }
  let splitLines;
  try {
    splitLines = calculateSplit(input.amountMinor, participantIds.map(String), input.splitMethod, values);
  } catch (error) {
    if (error instanceof SplitValidationError) throw badRequest(error.message);
    throw error;
  }
  const payerAmounts = payerIds.map((userId) => ({ userId, amountMinor: payerInput[String(userId)] ?? (payerIds.length === 1 ? input.amountMinor : 0) }));
  if (payerAmounts.reduce((sum, item) => sum + item.amountMinor, 0) !== input.amountMinor) {
    throw badRequest("What each person paid must add up to the expense total.");
  }
  calculateDebts(payerAmounts.map((p) => ({ userId: String(p.userId), amountMinor: p.amountMinor })), splitLines.map((line) => ({ userId: line.participantId, amountMinor: line.amountMinor })), input.currency);
  return {
    groupId,
    participantIds,
    payerAmounts,
    split: splitLines.map((line) => ({ userId: Number(line.participantId), value: line.value, amountMinor: line.amountMinor }))
  };
}
async function writeLines(tx, expenseId, prepared) {
  await tx.insert(expenseParticipants).values(prepared.split.map((line) => ({ expenseId, userId: line.userId, value: String(line.value), amountMinor: line.amountMinor })));
  await tx.insert(expensePayers).values(prepared.payerAmounts.map((payer) => ({ expenseId, userId: payer.userId, amountMinor: payer.amountMinor })));
}
function assertInvolved(actorId, prepared) {
  if (!prepared.participantIds.includes(actorId) && !prepared.payerAmounts.some((p) => p.userId === actorId)) {
    throw badRequest("You need to be part of an expense (as a payer or in the split) to save it.");
  }
}
async function createExpenseForUser(actorId, input) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const prepared = await prepareExpense(tx, actorId, input);
    assertInvolved(actorId, prepared);
    const publicId = crypto.randomUUID();
    const inserted = await tx.insert(expenses).values({
      publicId,
      groupId: prepared.groupId,
      createdBy: actorId,
      description: input.description,
      amountMinor: input.amountMinor,
      currency: input.currency,
      originalAmountMinor: input.amountMinor,
      originalCurrency: input.currency,
      splitMethod: input.splitMethod,
      category: input.category ?? "Other",
      note: input.note?.trim() || null,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : /* @__PURE__ */ new Date()
    }).returning({ id: expenses.id });
    const expenseId = inserted[0].id;
    await writeLines(tx, expenseId, prepared);
    if (prepared.groupId) await tx.update(groups).set({ updatedAt: /* @__PURE__ */ new Date() }).where(eq(groups.id, prepared.groupId));
    await logActivity(tx, { actorId, groupId: prepared.groupId, kind: "expense", title: input.description, message: `Added ${formatPlain(input.amountMinor, input.currency)}`, relatedEntityType: "expense", relatedEntityId: publicId });
    const actor = (await loadUsers(tx, [actorId])).get(actorId);
    const everyone = [...prepared.participantIds, ...prepared.payerAmounts.map((p) => p.userId)];
    await notify(tx, everyone.filter((id) => id !== actorId), "expense", {
      type: "expense.created",
      title: `${displayName(actor)} added \u201C${input.description}\u201D`,
      message: `${formatPlain(input.amountMinor, input.currency)} \u2014 tap to see your share.`,
      relatedEntityType: "expense",
      relatedEntityId: publicId
    });
    return { publicId, amountMinor: input.amountMinor, currency: input.currency, split: prepared.split.map((line) => ({ participantId: String(line.userId), value: line.value, amountMinor: line.amountMinor })) };
  });
}
async function loadVisibleExpense(tx, userId, publicId) {
  const rows = await tx.select().from(expenses).where(and(eq(expenses.publicId, publicId), isNull(expenses.deletedAt))).limit(1);
  const expense = rows[0];
  if (!expense) throw notFound("This expense no longer exists.");
  const lines = await loadExpenseLines(tx, [expense.id]);
  const payers = lines.payers.get(expense.id) ?? [];
  const participants = lines.participants.get(expense.id) ?? [];
  let allowed = payers.some((p) => p.userId === userId) || participants.some((p) => p.userId === userId) || expense.createdBy === userId;
  if (!allowed && expense.groupId) {
    const membership = await tx.select({ userId: groupMembers.userId }).from(groupMembers).where(and(eq(groupMembers.groupId, expense.groupId), eq(groupMembers.userId, userId), isNull(groupMembers.leftAt))).limit(1);
    allowed = membership.length > 0;
  }
  if (!allowed) throw notFound("This expense no longer exists.");
  return { expense, payers, participants };
}
async function getExpenseForUser(userId, publicId) {
  const db = getDb();
  const { expense, payers, participants } = await loadVisibleExpense(db, userId, publicId);
  const people = await loadUsers(db, [expense.createdBy, ...payers.map((p) => p.userId), ...participants.map((p) => p.userId)]);
  const group = expense.groupId ? (await db.select({ publicId: groups.publicId, name: groups.name }).from(groups).where(eq(groups.id, expense.groupId)).limit(1))[0] ?? null : null;
  const person = (id) => {
    const u = people.get(id);
    return { userId: u?.publicId ?? String(id), name: u?.deletedAt ? "Deleted user" : displayName(u), avatarUrl: u?.profileImageUrl ?? null, isMe: id === userId };
  };
  const creator = person(expense.createdBy);
  const myPaid = payers.filter((p) => p.userId === userId).reduce((s, p) => s + p.amountMinor, 0);
  const myShare = participants.filter((p) => p.userId === userId).reduce((s, p) => s + p.amountMinor, 0);
  return {
    id: expense.publicId,
    description: expense.description,
    amountMinor: expense.amountMinor,
    currency: toCurrencyCode(expense.currency),
    category: expense.category,
    splitMethod: expense.splitMethod,
    note: expense.note,
    occurredAt: expense.occurredAt.toISOString(),
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
    group,
    createdBy: creator,
    canEdit: expense.createdBy === userId,
    payers: payers.map((p) => ({ ...person(p.userId), amountMinor: p.amountMinor })),
    participants: participants.map((p) => ({ ...person(p.userId), amountMinor: p.amountMinor })),
    /** Raw split values (percent / shares / exact minor units), keyed by public user id — used to prefill the edit form. */
    values: await (async () => {
      const valueRows = await db.select({ userId: expenseParticipants.userId, value: expenseParticipants.value }).from(expenseParticipants).where(eq(expenseParticipants.expenseId, expense.id));
      return Object.fromEntries(valueRows.map((row) => [people.get(row.userId)?.publicId ?? String(row.userId), Number(row.value)]));
    })(),
    myNetMinor: myPaid - myShare
  };
}
async function updateExpenseForUser(actorId, input) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const { expense, payers, participants } = await loadVisibleExpense(tx, actorId, input.id);
    if (expense.createdBy !== actorId) {
      const creator = (await loadUsers(tx, [expense.createdBy])).get(expense.createdBy);
      throw forbidden(`Only ${displayName(creator)} (who added this expense) can edit it.`);
    }
    const before = /* @__PURE__ */ new Set([...payers.map((p) => p.userId), ...participants.map((p) => p.userId)]);
    const prepared = await prepareExpense(tx, actorId, input, before);
    assertInvolved(actorId, prepared);
    await tx.update(expenses).set({
      groupId: prepared.groupId,
      description: input.description,
      amountMinor: input.amountMinor,
      currency: input.currency,
      originalAmountMinor: input.amountMinor,
      originalCurrency: input.currency,
      splitMethod: input.splitMethod,
      category: input.category ?? expense.category,
      note: input.note?.trim() || null,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : expense.occurredAt
    }).where(eq(expenses.id, expense.id));
    await tx.delete(expenseParticipants).where(eq(expenseParticipants.expenseId, expense.id));
    await tx.delete(expensePayers).where(eq(expensePayers.expenseId, expense.id));
    await writeLines(tx, expense.id, prepared);
    await logActivity(tx, { actorId, groupId: prepared.groupId, kind: "expense", title: input.description, message: `Edited \u2014 now ${formatPlain(input.amountMinor, input.currency)}`, relatedEntityType: "expense", relatedEntityId: expense.publicId });
    const actor = (await loadUsers(tx, [actorId])).get(actorId);
    const affected = /* @__PURE__ */ new Set([...before, ...prepared.participantIds, ...prepared.payerAmounts.map((p) => p.userId)]);
    affected.delete(actorId);
    await notify(tx, [...affected], "expense", {
      type: "expense.updated",
      title: `${displayName(actor)} edited \u201C${input.description}\u201D`,
      message: `Now ${formatPlain(input.amountMinor, input.currency)}. Your balance has been updated.`,
      relatedEntityType: "expense",
      relatedEntityId: expense.publicId
    });
    return { publicId: expense.publicId };
  });
}
async function deleteExpenseForUser(actorId, publicId) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const { expense, payers, participants } = await loadVisibleExpense(tx, actorId, publicId);
    if (expense.createdBy !== actorId) {
      const creator = (await loadUsers(tx, [expense.createdBy])).get(expense.createdBy);
      throw forbidden(`Only ${displayName(creator)} (who added this expense) can delete it.`);
    }
    await tx.update(expenses).set({ deletedAt: /* @__PURE__ */ new Date() }).where(eq(expenses.id, expense.id));
    await logActivity(tx, { actorId, groupId: expense.groupId, kind: "expense", title: expense.description, message: `Deleted ${formatPlain(expense.amountMinor, expense.currency)}`, relatedEntityType: "expense", relatedEntityId: expense.publicId });
    const actor = (await loadUsers(tx, [actorId])).get(actorId);
    const affected = /* @__PURE__ */ new Set([...payers.map((p) => p.userId), ...participants.map((p) => p.userId)]);
    affected.delete(actorId);
    await notify(tx, [...affected], "expense", {
      type: "expense.deleted",
      title: `${displayName(actor)} deleted \u201C${expense.description}\u201D`,
      message: `${formatPlain(expense.amountMinor, expense.currency)} was removed from your balances.`,
      relatedEntityType: "expense",
      relatedEntityId: expense.publicId
    });
    return { success: true };
  });
}
async function listExpensesForUser(userId, options = {}) {
  const db = getDb();
  const limit = Math.min(options.limit ?? 100, 200);
  const myGroups = await db.select({ groupId: groupMembers.groupId }).from(groupMembers).where(and(eq(groupMembers.userId, userId), isNull(groupMembers.leftAt)));
  const myGroupIds = myGroups.map((row) => row.groupId);
  let groupFilter = null;
  if (options.groupId) {
    const g = await db.select({ id: groups.id }).from(groups).where(eq(groups.publicId, options.groupId)).limit(1);
    groupFilter = g[0]?.id ?? -1;
  }
  const rows = await db.selectDistinct({ expense: expenses }).from(expenses).leftJoin(expenseParticipants, eq(expenseParticipants.expenseId, expenses.id)).leftJoin(expensePayers, eq(expensePayers.expenseId, expenses.id)).where(and(
    isNull(expenses.deletedAt),
    groupFilter !== null ? eq(expenses.groupId, groupFilter) : void 0,
    or(
      eq(expenseParticipants.userId, userId),
      eq(expensePayers.userId, userId),
      myGroupIds.length ? inArray(expenses.groupId, myGroupIds) : void 0
    )
  )).orderBy(desc(expenses.occurredAt), desc(expenses.id)).limit(limit);
  const list = rows.map((row) => row.expense);
  const lines = await loadExpenseLines(db, list.map((e) => e.id));
  const groupIds = [...new Set(list.map((e) => e.groupId).filter((id) => id !== null))];
  const groupRows = groupIds.length ? await db.select({ id: groups.id, publicId: groups.publicId, name: groups.name }).from(groups).where(inArray(groups.id, groupIds)) : [];
  const groupById = new Map(groupRows.map((g) => [g.id, g]));
  const people = await loadUsers(db, list.flatMap((e) => (lines.payers.get(e.id) ?? []).map((p) => p.userId)));
  return list.map((expense) => {
    const payers = lines.payers.get(expense.id) ?? [];
    const shares = lines.participants.get(expense.id) ?? [];
    const paid = payers.filter((p) => p.userId === userId).reduce((s, p) => s + p.amountMinor, 0);
    const share = shares.filter((p) => p.userId === userId).reduce((s, p) => s + p.amountMinor, 0);
    const mainPayer = payers.length === 1 ? payers[0] : null;
    const paidByName = mainPayer ? mainPayer.userId === userId ? "You" : displayName(people.get(mainPayer.userId)) : `${payers.length} people`;
    const group = expense.groupId ? groupById.get(expense.groupId) : void 0;
    return {
      id: expense.publicId,
      description: expense.description,
      amountMinor: expense.amountMinor,
      currency: toCurrencyCode(expense.currency),
      category: expense.category,
      occurredAt: expense.occurredAt.toISOString(),
      groupId: group?.publicId ?? null,
      groupName: group?.name ?? null,
      paidByName,
      involved: paid > 0 || share > 0,
      /** Positive: you lent this much. Negative: you borrowed this much. */
      myNetMinor: paid - share,
      createdByMe: expense.createdBy === userId
    };
  });
}
export {
  createExpenseForUser,
  deleteExpenseForUser,
  getExpenseForUser,
  listExpensesForUser,
  updateExpenseForUser
};
