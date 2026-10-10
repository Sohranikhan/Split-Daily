import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { groupMembers, groups, settlements, users } from "../db/schema";
import { toCurrencyCode, type CreateSettlementInput, type UpdateSettlementStatusInput } from "../../../shared/domain";
import { getDb } from "../db/client";
import { badRequest, displayName, forbidden, formatPlain, loadUsers, logActivity, notFound, notify, type Tx } from "./common";

async function resolveUserId(tx: Tx, identifier: string) {
  const rows = await tx.select({ id: users.id }).from(users).where(Number.isInteger(Number(identifier)) ? eq(users.id, Number(identifier)) : eq(users.publicId, identifier)).limit(1);
  return rows[0]?.id;
}

/**
 * Records a payment between two people. Whoever records it vouches for it:
 * the payer saying "I paid" creates it as `paid` (the receiver can confirm),
 * the receiver saying "they paid me" creates it already `confirmed`.
 */
export async function createSettlementForUser(actorId: number, input: CreateSettlementInput) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const payerId = await resolveUserId(tx, input.payerId);
    const receiverId = await resolveUserId(tx, input.receiverId);
    if (!payerId || !receiverId || payerId === receiverId) throw badRequest("Choose two different people for a payment.");
    if (actorId !== payerId && actorId !== receiverId) throw forbidden("You can only record payments you made or received.");
    let groupId: number | null = null;
    if (input.groupId) {
      const groupRows = await tx.select({ id: groups.id }).from(groups).where(and(eq(groups.publicId, input.groupId), isNull(groups.archivedAt))).limit(1);
      groupId = groupRows[0]?.id ?? null;
      if (!groupId) throw notFound("That group could not be found.");
      const memberships = await tx.select({ userId: groupMembers.userId }).from(groupMembers).where(and(eq(groupMembers.groupId, groupId), isNull(groupMembers.leftAt)));
      const memberIds = new Set(memberships.map((member) => member.userId));
      if (!memberIds.has(payerId) || !memberIds.has(receiverId)) throw badRequest("Both people must be members of the group.");
    }
    const status = actorId === receiverId ? ("confirmed" as const) : ("paid" as const);
    const publicId = crypto.randomUUID();
    await tx.insert(settlements).values({ publicId, groupId, payerId, receiverId, amountMinor: input.amountMinor, currency: input.currency, paymentMethod: input.paymentMethod, note: input.note || null, status, settledAt: new Date() });
    const people = await loadUsers(tx, [payerId, receiverId]);
    const payerName = displayName(people.get(payerId));
    const receiverName = displayName(people.get(receiverId));
    await logActivity(tx, { actorId, groupId, kind: "settlement", title: `${payerName} paid ${receiverName}`, message: `${formatPlain(input.amountMinor, input.currency)} via ${input.paymentMethod}`, relatedEntityType: "settlement", relatedEntityId: publicId });
    const other = actorId === payerId ? receiverId : payerId;
    await notify(tx, [other], "settlement", {
      type: "settlement.created",
      title: actorId === payerId ? `${payerName} paid you ${formatPlain(input.amountMinor, input.currency)}` : `${receiverName} recorded your payment`,
      message: actorId === payerId ? "Confirm it in Activity once you've received it." : `${formatPlain(input.amountMinor, input.currency)} was marked as received.`,
      relatedEntityType: "settlement",
      relatedEntityId: publicId,
    });
    return { publicId, status };
  });
}

export async function updateSettlementStatusForUser(actorId: number, input: UpdateSettlementStatusInput) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(settlements).where(eq(settlements.publicId, input.publicId)).limit(1);
    const settlement = rows[0];
    if (!settlement || (settlement.payerId !== actorId && settlement.receiverId !== actorId)) throw notFound("Payment not found.");
    if (settlement.status === "cancelled") throw badRequest("This payment was already cancelled.");
    if (input.status === "paid" && actorId !== settlement.payerId) throw forbidden("Only the payer can mark a payment as paid.");
    if (input.status === "confirmed" && actorId !== settlement.receiverId) throw forbidden("Only the receiver can confirm a payment.");
    if (input.status === "confirmed" && settlement.status === "confirmed") return { publicId: settlement.publicId, status: settlement.status };
    await tx.update(settlements).set({ status: input.status, settledAt: input.status === "cancelled" ? settlement.settledAt : new Date() }).where(eq(settlements.id, settlement.id));
    await logActivity(tx, { actorId, groupId: settlement.groupId, kind: "settlement", title: input.status === "cancelled" ? "Payment cancelled" : "Payment confirmed", message: formatPlain(settlement.amountMinor, settlement.currency), relatedEntityType: "settlement", relatedEntityId: settlement.publicId });
    const other = actorId === settlement.payerId ? settlement.receiverId : settlement.payerId;
    const actor = (await loadUsers(tx, [actorId])).get(actorId);
    await notify(tx, [other], "settlement", {
      type: `settlement.${input.status}`,
      title: input.status === "cancelled" ? `${displayName(actor)} cancelled a payment` : `${displayName(actor)} confirmed your payment`,
      message: formatPlain(settlement.amountMinor, settlement.currency),
      relatedEntityType: "settlement",
      relatedEntityId: settlement.publicId,
    });
    return { publicId: settlement.publicId, status: input.status };
  });
}

export async function listSettlementsForUser(userId: number) {
  const db = getDb();
  const rows = await db.select().from(settlements).where(or(eq(settlements.payerId, userId), eq(settlements.receiverId, userId))).orderBy(desc(settlements.createdAt)).limit(100);
  const people = await loadUsers(db, rows.flatMap((row) => [row.payerId, row.receiverId]));
  const groupIds = [...new Set(rows.map((r) => r.groupId).filter((id): id is number => id !== null))];
  const groupRows = groupIds.length ? await db.select({ id: groups.id, name: groups.name, publicId: groups.publicId }).from(groups).where(inArray(groups.id, groupIds)) : [];
  const groupById = new Map(groupRows.map((g) => [g.id, g]));
  return rows.map((row) => ({
    publicId: row.publicId,
    amountMinor: row.amountMinor,
    currency: toCurrencyCode(row.currency),
    status: row.status,
    paymentMethod: row.paymentMethod,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    iAmPayer: row.payerId === userId,
    payerName: row.payerId === userId ? "You" : displayName(people.get(row.payerId)),
    receiverName: row.receiverId === userId ? "You" : displayName(people.get(row.receiverId)),
    groupName: row.groupId ? groupById.get(row.groupId)?.name ?? null : null,
    canConfirm: row.status === "paid" && row.receiverId === userId,
    canCancel: row.status !== "cancelled",
  }));
}
