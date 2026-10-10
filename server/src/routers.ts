import { z } from "zod";
import {
  addGroupMembersInputSchema,
  createExpenseInputSchema,
  createGroupInputSchema,
  createSettlementInputSchema,
  updateExpenseInputSchema,
  updateGroupInputSchema,
  updateNotificationPreferencesInputSchema,
  updateProfileInputSchema,
  updateSettlementStatusInputSchema,
} from "../../shared/domain";
import { revokeSession } from "./auth/sessions";
import { toPublicUser } from "./auth/users";
import { getDashboardForUser, getNotificationsForUser, markAllNotificationsReadForUser, markNotificationReadForUser } from "./db/queries";
import { deleteAccountForUser, getSettingsForUser, updateNotificationPreferencesForUser, updateProfileForUser } from "./services/account-service";
import { createExpenseForUser, deleteExpenseForUser, getExpenseForUser, listExpensesForUser, updateExpenseForUser } from "./services/expense-service";
import {
  addGroupMembersForUser,
  cancelInviteForUser,
  createGroupForUser,
  deleteGroupForUser,
  getGroupForUser,
  getGroupInviteLinkForUser,
  joinGroupByCodeForUser,
  listContactsForUser,
  previewInviteForUser,
  removeGroupMemberForUser,
  updateGroupForUser,
} from "./services/group-service";
import { createSettlementForUser, listSettlementsForUser, updateSettlementStatusForUser } from "./services/settlement-service";
import { protectedProcedure, publicProcedure, router } from "./trpc/trpc";

const idInput = z.object({ id: z.string().min(1) });
const codeInput = z.object({ code: z.string().trim().min(4).max(64) });

export const appRouter = router({
  system: router({
    health: publicProcedure.query(() => ({ ok: true as const })),
  }),
  auth: router({
    me: publicProcedure.query(({ ctx }) => (ctx.user ? toPublicUser(ctx.user) : null)),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      if (ctx.sessionId) await revokeSession(ctx.sessionId);
      return { success: true } as const;
    }),
  }),
  account: router({
    settings: protectedProcedure.query(({ ctx }) => getSettingsForUser(ctx.user)),
    updateProfile: protectedProcedure.input(updateProfileInputSchema).mutation(({ ctx, input }) => updateProfileForUser(ctx.user.id, input)),
    updateNotifications: protectedProcedure.input(updateNotificationPreferencesInputSchema).mutation(({ ctx, input }) => updateNotificationPreferencesForUser(ctx.user.id, input)),
    delete: protectedProcedure.input(z.object({ confirm: z.literal("DELETE") })).mutation(({ ctx }) => deleteAccountForUser(ctx.user.id)),
  }),
  dashboard: router({ summary: protectedProcedure.query(({ ctx }) => getDashboardForUser(ctx.user)) }),
  groups: router({
    list: protectedProcedure.query(async ({ ctx }) => (await getDashboardForUser(ctx.user)).groups),
    get: protectedProcedure.input(idInput).query(({ ctx, input }) => getGroupForUser(ctx.user.id, input.id)),
    create: protectedProcedure.input(createGroupInputSchema).mutation(({ ctx, input }) => createGroupForUser(ctx.user.id, input)),
    update: protectedProcedure.input(updateGroupInputSchema).mutation(({ ctx, input }) => updateGroupForUser(ctx.user.id, input)),
    delete: protectedProcedure.input(idInput).mutation(({ ctx, input }) => deleteGroupForUser(ctx.user.id, input.id)),
    addMembers: protectedProcedure.input(addGroupMembersInputSchema).mutation(({ ctx, input }) => addGroupMembersForUser(ctx.user.id, input)),
    removeMember: protectedProcedure.input(z.object({ groupId: z.string().min(1), userId: z.string().min(1) })).mutation(({ ctx, input }) => removeGroupMemberForUser(ctx.user.id, input.groupId, input.userId)),
    leave: protectedProcedure.input(idInput).mutation(({ ctx, input }) => removeGroupMemberForUser(ctx.user.id, input.id, ctx.user.publicId)),
    inviteLink: protectedProcedure.input(idInput).mutation(({ ctx, input }) => getGroupInviteLinkForUser(ctx.user.id, input.id)),
    cancelInvite: protectedProcedure.input(z.object({ groupId: z.string().min(1), inviteId: z.string().min(1) })).mutation(({ ctx, input }) => cancelInviteForUser(ctx.user.id, input.groupId, input.inviteId)),
    previewInvite: protectedProcedure.input(codeInput).query(({ ctx, input }) => previewInviteForUser(ctx.user.id, input.code)),
    join: protectedProcedure.input(codeInput).mutation(({ ctx, input }) => joinGroupByCodeForUser(ctx.user.id, input.code)),
    contacts: protectedProcedure.query(({ ctx }) => listContactsForUser(ctx.user.id)),
  }),
  expenses: router({
    list: protectedProcedure.input(z.object({ groupId: z.string().min(1).optional(), limit: z.number().int().min(1).max(200).optional() }).optional()).query(({ ctx, input }) => listExpensesForUser(ctx.user.id, input ?? {})),
    /** Kept for older app builds. */
    recent: protectedProcedure.query(async ({ ctx }) => (await getDashboardForUser(ctx.user)).activity.filter((item) => item.kind === "expense")),
    get: protectedProcedure.input(idInput).query(({ ctx, input }) => getExpenseForUser(ctx.user.id, input.id)),
    create: protectedProcedure.input(createExpenseInputSchema).mutation(({ ctx, input }) => createExpenseForUser(ctx.user.id, input)),
    update: protectedProcedure.input(updateExpenseInputSchema).mutation(({ ctx, input }) => updateExpenseForUser(ctx.user.id, input)),
    delete: protectedProcedure.input(idInput).mutation(({ ctx, input }) => deleteExpenseForUser(ctx.user.id, input.id)),
  }),
  settlements: router({
    list: protectedProcedure.query(({ ctx }) => listSettlementsForUser(ctx.user.id)),
    create: protectedProcedure.input(createSettlementInputSchema).mutation(({ ctx, input }) => createSettlementForUser(ctx.user.id, input)),
    updateStatus: protectedProcedure.input(updateSettlementStatusInputSchema).mutation(({ ctx, input }) => updateSettlementStatusForUser(ctx.user.id, input)),
  }),
  notifications: router({
    list: protectedProcedure.query(({ ctx }) => getNotificationsForUser(ctx.user.id)),
    markRead: protectedProcedure.input(z.object({ publicId: z.string().min(1) })).mutation(({ ctx, input }) => markNotificationReadForUser(ctx.user.id, input.publicId)),
    markAllRead: protectedProcedure.mutation(({ ctx }) => markAllNotificationsReadForUser(ctx.user.id)),
  }),
});

export type AppRouter = typeof appRouter;
