import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNull, ne } from "drizzle-orm";
import { expenses, groupInvitations, groupMembers, groups, users } from "../models";
import { groupAccent, toCurrencyCode, type AddGroupMembersInput, type CreateGroupInput, type UpdateGroupInput } from "../../../shared/domain";
import { getDb } from "../database/client";
import { computeGroupLedger, loadExpenseLines, toAmounts } from "./balance.service";
import { badRequest, displayName, forbidden, loadUsers, logActivity, notFound, notify, requireGroupMembership, type Tx } from "./helpers";

const DAY_MS = 24 * 60 * 60 * 1000;
const LINK_TTL_MS = 365 * DAY_MS;
const EMAIL_INVITE_TTL_MS = 60 * DAY_MS;

/** Short, unambiguous, URL-safe invite code (no 0/O/1/I). */
function inviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

const canManage = (role: string) => role === "owner" || role === "admin";

export async function createGroupForUser(ownerId: number, input: CreateGroupInput) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const publicId = crypto.randomUUID();
    const inserted = await tx.insert(groups).values({ publicId, name: input.name, description: input.description || null, category: input.category, currency: input.currency, createdBy: ownerId }).returning({ id: groups.id });
    const groupId = inserted[0]!.id;
    await tx.insert(groupMembers).values({ groupId, userId: ownerId, role: "owner" });
    await logActivity(tx, { actorId: ownerId, groupId, kind: "group", title: input.name, message: "Created the group", relatedEntityType: "group", relatedEntityId: publicId });
    return { publicId, name: input.name, category: input.category, currency: input.currency };
  });
}

export async function updateGroupForUser(actorId: number, input: UpdateGroupInput) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const { group } = await requireGroupMembership(tx, input.id, actorId);
    const patch: Partial<typeof groups.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description || null;
    if (input.category !== undefined) patch.category = input.category;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (!Object.keys(patch).length) return { publicId: group.publicId };
    await tx.update(groups).set(patch).where(eq(groups.id, group.id));
    await logActivity(tx, { actorId, groupId: group.id, kind: "group", title: input.name ?? group.name, message: "Updated the group settings", relatedEntityType: "group", relatedEntityId: group.publicId });
    return { publicId: group.publicId };
  });
}

export async function getGroupForUser(userId: number, publicId: string) {
  const db = getDb();
  const { group, role } = await requireGroupMembership(db, publicId, userId);
  const memberRows = await db
    .select({ id: users.id, publicId: users.publicId, name: users.name, email: users.email, avatarUrl: users.profileImageUrl, role: groupMembers.role, joinedAt: groupMembers.joinedAt })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(and(eq(groupMembers.groupId, group.id), isNull(groupMembers.leftAt)))
    .orderBy(asc(groupMembers.joinedAt));
  const { memberNets, debts } = await computeGroupLedger(db, group.id);

  // People referenced by balances may have left the group; load their names too.
  const extraIds = debts.flatMap((d) => [Number(d.fromId), Number(d.toId)]).filter((id) => !memberRows.some((m) => m.id === id));
  const extra = await loadUsers(db, extraIds);
  const nameOf = (id: number) => {
    if (id === userId) return "You";
    const member = memberRows.find((m) => m.id === id);
    if (member) return displayName(member);
    const other = extra.get(id);
    return other?.deletedAt ? "Deleted user" : displayName(other);
  };
  const publicIdOf = (id: number) => memberRows.find((m) => m.id === id)?.publicId ?? extra.get(id)?.publicId ?? String(id);

  const expenseRows = await db.select().from(expenses).where(and(eq(expenses.groupId, group.id), isNull(expenses.deletedAt))).orderBy(desc(expenses.occurredAt), desc(expenses.id)).limit(100);
  const lines = await loadExpenseLines(db, expenseRows.map((e) => e.id));
  const payerNames = await loadUsers(db, expenseRows.flatMap((e) => (lines.payers.get(e.id) ?? []).map((p) => p.userId)));

  const invites = await db.select().from(groupInvitations).where(and(eq(groupInvitations.groupId, group.id), isNull(groupInvitations.acceptedAt), gt(groupInvitations.expiresAt, new Date()))).orderBy(desc(groupInvitations.createdAt));

  return {
    id: group.publicId,
    name: group.name,
    description: group.description,
    category: group.category,
    currency: toCurrencyCode(group.currency),
    accent: groupAccent(group.category),
    myRole: role,
    canManage: canManage(role),
    myBalances: toAmounts(memberNets.get(userId)),
    members: memberRows.map((member) => ({
      publicId: member.publicId,
      name: displayName(member),
      email: member.email,
      avatarUrl: member.avatarUrl,
      role: member.role,
      isMe: member.id === userId,
      balances: toAmounts(memberNets.get(member.id)),
    })),
    debts: debts.map((debt) => ({
      fromId: publicIdOf(Number(debt.fromId)),
      fromName: nameOf(Number(debt.fromId)),
      toId: publicIdOf(Number(debt.toId)),
      toName: nameOf(Number(debt.toId)),
      amountMinor: debt.amountMinor,
      currency: debt.currency,
      involvesMe: Number(debt.fromId) === userId || Number(debt.toId) === userId,
    })),
    pendingInvites: invites.filter((invite) => invite.inviteeEmail).map((invite) => ({ id: invite.publicId, email: invite.inviteeEmail!, code: invite.code, createdAt: invite.createdAt.toISOString() })),
    expenses: expenseRows.map((expense) => {
      const payers = lines.payers.get(expense.id) ?? [];
      const shares = lines.participants.get(expense.id) ?? [];
      const paid = payers.filter((p) => p.userId === userId).reduce((s, p) => s + p.amountMinor, 0);
      const share = shares.filter((p) => p.userId === userId).reduce((s, p) => s + p.amountMinor, 0);
      const only = payers.length === 1 ? payers[0]! : null;
      return {
        id: expense.publicId,
        description: expense.description,
        amountMinor: expense.amountMinor,
        currency: toCurrencyCode(expense.currency),
        category: expense.category,
        occurredAt: expense.occurredAt.toISOString(),
        paidByName: only ? (only.userId === userId ? "You" : displayName(payerNames.get(only.userId))) : `${payers.length} people`,
        myNetMinor: paid - share,
        involved: paid > 0 || share > 0,
        createdByMe: expense.createdBy === userId,
      };
    }),
  };
}

async function addMembership(tx: Tx, groupId: number, userId: number) {
  const existing = await tx.select().from(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId))).limit(1);
  if (existing[0] && !existing[0].leftAt) return false;
  if (existing[0]) {
    await tx.update(groupMembers).set({ leftAt: null, joinedAt: new Date(), role: "member" }).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  } else {
    await tx.insert(groupMembers).values({ groupId, userId, role: "member" });
  }
  return true;
}

export async function addGroupMembersForUser(actorId: number, input: AddGroupMembersInput) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const { group } = await requireGroupMembership(tx, input.groupId, actorId);
    const actor = (await loadUsers(tx, [actorId])).get(actorId);
    const added: string[] = [];
    const invited: string[] = [];
    const alreadyMembers: string[] = [];
    const toAdd = new Set<number>();

    if (input.userIds.length) {
      const rows = await tx.select({ id: users.id }).from(users).where(and(inArray(users.publicId, input.userIds), isNull(users.deletedAt)));
      if (rows.length !== new Set(input.userIds).size) throw badRequest("Some of those people could not be found.");
      rows.forEach((row) => toAdd.add(row.id));
    }

    const emails = [...new Set(input.emails)];
    if (emails.length) {
      const existing = await tx.select({ id: users.id, email: users.email }).from(users).where(and(inArray(users.email, emails), isNull(users.deletedAt)));
      const known = new Map(existing.map((row) => [row.email!, row.id]));
      for (const email of emails) {
        const userId = known.get(email);
        if (userId) {
          toAdd.add(userId);
          continue;
        }
        // No account yet: create (or reuse) an email invitation. They join automatically when they sign in with this email.
        const pending = await tx.select({ id: groupInvitations.id }).from(groupInvitations).where(and(eq(groupInvitations.groupId, group.id), eq(groupInvitations.inviteeEmail, email), isNull(groupInvitations.acceptedAt), gt(groupInvitations.expiresAt, new Date()))).limit(1);
        if (!pending.length) {
          await tx.insert(groupInvitations).values({ publicId: crypto.randomUUID(), groupId: group.id, inviterId: actorId, inviteeEmail: email, code: inviteCode(), expiresAt: new Date(Date.now() + EMAIL_INVITE_TTL_MS) });
        }
        invited.push(email);
      }
    }

    const people = await loadUsers(tx, [...toAdd]);
    const newlyAdded: number[] = [];
    for (const userId of toAdd) {
      const name = displayName(people.get(userId));
      if (await addMembership(tx, group.id, userId)) {
        newlyAdded.push(userId);
        added.push(name);
      } else {
        alreadyMembers.push(name);
      }
    }
    if (newlyAdded.length || invited.length) {
      await tx.update(groups).set({ updatedAt: new Date() }).where(eq(groups.id, group.id));
      const names = [...added, ...invited];
      await logActivity(tx, { actorId, groupId: group.id, kind: "group", title: group.name, message: `Added ${names.join(", ")}`, relatedEntityType: "group", relatedEntityId: group.publicId });
    }
    await notify(tx, newlyAdded.filter((id) => id !== actorId), "group", {
      type: "group.member_added",
      title: `You were added to ${group.name}`,
      message: `${displayName(actor)} added you to the group.`,
      relatedEntityType: "group",
      relatedEntityId: group.publicId,
    });
    return { added, invited, alreadyMembers };
  });
}

export async function removeGroupMemberForUser(actorId: number, groupPublicId: string, memberPublicId: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const { group, role } = await requireGroupMembership(tx, groupPublicId, actorId);
    const target = (await tx.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.publicId, memberPublicId)).limit(1))[0];
    if (!target) throw notFound("That person could not be found.");
    const leaving = target.id === actorId;
    if (!leaving && !canManage(role)) throw forbidden("Only the group owner or an admin can remove members.");
    const membership = (await tx.select().from(groupMembers).where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, target.id), isNull(groupMembers.leftAt))).limit(1))[0];
    if (!membership) throw notFound("They are not in this group.");
    if (!leaving && membership.role === "owner") throw forbidden("The group owner can't be removed.");

    const { memberNets } = await computeGroupLedger(tx, group.id);
    const open = toAmounts(memberNets.get(target.id));
    if (open.length) {
      throw badRequest(leaving ? "Settle up your balance in this group before leaving." : `${displayName(target)} still has an unsettled balance in this group. Settle up first.`);
    }

    await tx.update(groupMembers).set({ leftAt: new Date() }).where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, target.id)));

    // If the owner leaves, hand ownership to the longest-standing remaining member.
    if (leaving && membership.role === "owner") {
      const next = (await tx.select({ userId: groupMembers.userId }).from(groupMembers).where(and(eq(groupMembers.groupId, group.id), isNull(groupMembers.leftAt), ne(groupMembers.userId, actorId))).orderBy(asc(groupMembers.joinedAt)).limit(1))[0];
      if (next) await tx.update(groupMembers).set({ role: "owner" }).where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, next.userId)));
      else await tx.update(groups).set({ archivedAt: new Date() }).where(eq(groups.id, group.id));
    }
    await logActivity(tx, { actorId, groupId: group.id, kind: "group", title: group.name, message: leaving ? "Left the group" : `Removed ${displayName(target)}`, relatedEntityType: "group", relatedEntityId: group.publicId });
    if (!leaving) {
      await notify(tx, [target.id], "group", { type: "group.member_removed", title: `You were removed from ${group.name}`, message: "You no longer have access to this group.", relatedEntityType: "group", relatedEntityId: group.publicId });
    }
    return { success: true as const, left: leaving };
  });
}

export async function deleteGroupForUser(actorId: number, groupPublicId: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const { group, role } = await requireGroupMembership(tx, groupPublicId, actorId);
    if (role !== "owner") throw forbidden("Only the group owner can delete the group.");
    const { memberNets } = await computeGroupLedger(tx, group.id);
    if ([...memberNets.values()].some((nets) => toAmounts(nets).length)) throw badRequest("Everyone needs to settle up before the group can be deleted.");
    await tx.update(groups).set({ archivedAt: new Date() }).where(eq(groups.id, group.id));
    const members = await tx.select({ userId: groupMembers.userId }).from(groupMembers).where(and(eq(groupMembers.groupId, group.id), isNull(groupMembers.leftAt)));
    await notify(tx, members.map((m) => m.userId).filter((id) => id !== actorId), "group", { type: "group.deleted", title: `${group.name} was deleted`, message: "The group owner deleted this group.", relatedEntityType: "group", relatedEntityId: group.publicId });
    return { success: true as const };
  });
}

/** A reusable invite link for the group (one per group, refreshed when expired). */
export async function getGroupInviteLinkForUser(actorId: number, groupPublicId: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const { group } = await requireGroupMembership(tx, groupPublicId, actorId);
    const existing = await tx.select().from(groupInvitations).where(and(eq(groupInvitations.groupId, group.id), isNull(groupInvitations.inviteeEmail), gt(groupInvitations.expiresAt, new Date(Date.now() + 7 * DAY_MS)))).orderBy(desc(groupInvitations.createdAt)).limit(1);
    if (existing[0]) return { code: existing[0].code, groupName: group.name };
    const code = inviteCode();
    await tx.insert(groupInvitations).values({ publicId: crypto.randomUUID(), groupId: group.id, inviterId: actorId, inviteeEmail: null, code, expiresAt: new Date(Date.now() + LINK_TTL_MS) });
    return { code, groupName: group.name };
  });
}

async function loadInvite(tx: Tx, code: string) {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const rows = await tx
    .select({ invite: groupInvitations, group: groups })
    .from(groupInvitations)
    .innerJoin(groups, eq(groups.id, groupInvitations.groupId))
    .where(and(eq(groupInvitations.code, normalized), gt(groupInvitations.expiresAt, new Date()), isNull(groups.archivedAt)))
    .limit(1);
  const row = rows[0];
  if (!row || (row.invite.inviteeEmail && row.invite.acceptedAt)) throw notFound("This invite code is invalid or has expired.");
  return row;
}

export async function previewInviteForUser(userId: number, code: string) {
  const db = getDb();
  const { invite, group } = await loadInvite(db, code);
  const memberCount = (await db.select({ userId: groupMembers.userId }).from(groupMembers).where(and(eq(groupMembers.groupId, group.id), isNull(groupMembers.leftAt)))).length;
  const inviter = (await loadUsers(db, [invite.inviterId])).get(invite.inviterId);
  const already = await db.select({ userId: groupMembers.userId }).from(groupMembers).where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, userId), isNull(groupMembers.leftAt))).limit(1);
  return { groupId: group.publicId, name: group.name, category: group.category, memberCount, inviterName: displayName(inviter), alreadyMember: already.length > 0 };
}

export async function joinGroupByCodeForUser(userId: number, code: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const { invite, group } = await loadInvite(tx, code);
    const joined = await addMembership(tx, group.id, userId);
    if (invite.inviteeEmail) await tx.update(groupInvitations).set({ acceptedAt: new Date() }).where(eq(groupInvitations.id, invite.id));
    if (joined) {
      const me = (await loadUsers(tx, [userId])).get(userId);
      await logActivity(tx, { actorId: userId, groupId: group.id, kind: "group", title: group.name, message: "Joined the group", relatedEntityType: "group", relatedEntityId: group.publicId });
      const others = await tx.select({ userId: groupMembers.userId }).from(groupMembers).where(and(eq(groupMembers.groupId, group.id), isNull(groupMembers.leftAt), ne(groupMembers.userId, userId)));
      await notify(tx, others.map((o) => o.userId), "group", { type: "group.member_joined", title: `${displayName(me)} joined ${group.name}`, message: "They can now be added to expenses.", relatedEntityType: "group", relatedEntityId: group.publicId });
    }
    return { groupId: group.publicId, name: group.name, joined };
  });
}

export async function cancelInviteForUser(actorId: number, groupPublicId: string, invitePublicId: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const { group } = await requireGroupMembership(tx, groupPublicId, actorId);
    await tx.update(groupInvitations).set({ expiresAt: new Date() }).where(and(eq(groupInvitations.publicId, invitePublicId), eq(groupInvitations.groupId, group.id)));
    return { success: true as const };
  });
}

/** Called right after sign-in: joins every group this email was invited to. */
export async function acceptEmailInvites(tx: Tx, user: { id: number; email: string | null; emailVerified: boolean }) {
  if (!user.email || !user.emailVerified) return;
  const invites = await tx
    .select({ invite: groupInvitations, group: groups })
    .from(groupInvitations)
    .innerJoin(groups, eq(groups.id, groupInvitations.groupId))
    .where(and(eq(groupInvitations.inviteeEmail, user.email.toLowerCase()), isNull(groupInvitations.acceptedAt), gt(groupInvitations.expiresAt, new Date()), isNull(groups.archivedAt)));
  for (const { invite, group } of invites) {
    await addMembership(tx, group.id, user.id);
    await tx.update(groupInvitations).set({ acceptedAt: new Date() }).where(eq(groupInvitations.id, invite.id));
    await logActivity(tx, { actorId: user.id, groupId: group.id, kind: "group", title: group.name, message: "Joined the group from an invite", relatedEntityType: "group", relatedEntityId: group.publicId });
  }
}

/** People you share at least one active group with — used to pick participants and new members. */
export async function listContactsForUser(userId: number) {
  const db = getDb();
  const mine = await db.select({ groupId: groupMembers.groupId }).from(groupMembers).innerJoin(groups, eq(groups.id, groupMembers.groupId)).where(and(eq(groupMembers.userId, userId), isNull(groupMembers.leftAt), isNull(groups.archivedAt)));
  const groupIds = mine.map((row) => row.groupId);
  if (!groupIds.length) return [];
  const rows = await db
    .selectDistinct({ id: users.id, publicId: users.publicId, name: users.name, email: users.email, avatarUrl: users.profileImageUrl })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .where(and(inArray(groupMembers.groupId, groupIds), isNull(groupMembers.leftAt), ne(groupMembers.userId, userId), isNull(users.deletedAt)));
  return rows.map((row) => ({ publicId: row.publicId, name: displayName(row), email: row.email, avatarUrl: row.avatarUrl })).sort((a, b) => a.name.localeCompare(b.name));
}
