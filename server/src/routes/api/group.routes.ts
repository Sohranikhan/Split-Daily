import { z } from "zod";
import { addGroupMembersInputSchema, createGroupInputSchema, updateGroupInputSchema } from "../../../../shared/domain";
import * as groups from "../../controllers/group.controller";
import { protectedProcedure, router } from "../../middleware/trpc";

const idInput = z.object({ id: z.string().min(1) });
const codeInput = z.object({ code: z.string().trim().min(4).max(64) });

export const groupRoutes = router({
  list: protectedProcedure.query(({ ctx }) => groups.list(ctx)),
  get: protectedProcedure.input(idInput).query(({ ctx, input }) => groups.get(ctx, input.id)),
  create: protectedProcedure.input(createGroupInputSchema).mutation(({ ctx, input }) => groups.create(ctx, input)),
  update: protectedProcedure.input(updateGroupInputSchema).mutation(({ ctx, input }) => groups.update(ctx, input)),
  delete: protectedProcedure.input(idInput).mutation(({ ctx, input }) => groups.remove(ctx, input.id)),
  addMembers: protectedProcedure.input(addGroupMembersInputSchema).mutation(({ ctx, input }) => groups.addMembers(ctx, input)),
  removeMember: protectedProcedure.input(z.object({ groupId: z.string().min(1), userId: z.string().min(1) })).mutation(({ ctx, input }) => groups.removeMember(ctx, input.groupId, input.userId)),
  leave: protectedProcedure.input(idInput).mutation(({ ctx, input }) => groups.leave(ctx, input.id)),
  inviteLink: protectedProcedure.input(idInput).mutation(({ ctx, input }) => groups.inviteLink(ctx, input.id)),
  cancelInvite: protectedProcedure.input(z.object({ groupId: z.string().min(1), inviteId: z.string().min(1) })).mutation(({ ctx, input }) => groups.cancelInvite(ctx, input.groupId, input.inviteId)),
  previewInvite: protectedProcedure.input(codeInput).query(({ ctx, input }) => groups.previewInvite(ctx, input.code)),
  join: protectedProcedure.input(codeInput).mutation(({ ctx, input }) => groups.join(ctx, input.code)),
  contacts: protectedProcedure.query(({ ctx }) => groups.contacts(ctx)),
});
