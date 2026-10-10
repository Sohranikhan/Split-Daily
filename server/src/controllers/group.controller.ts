import type { AddGroupMembersInput, CreateGroupInput, UpdateGroupInput } from "../../../shared/domain";
import type { AuthedContext } from "../middleware/trpc";
import { getDashboardForUser } from "../services/dashboard.service";
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
} from "../services/group.service";

/** Groups: create/edit/delete, members, invites and join codes. */
export const list = async (ctx: AuthedContext) => (await getDashboardForUser(ctx.user)).groups;
export const get = (ctx: AuthedContext, id: string) => getGroupForUser(ctx.user.id, id);
export const create = (ctx: AuthedContext, input: CreateGroupInput) => createGroupForUser(ctx.user.id, input);
export const update = (ctx: AuthedContext, input: UpdateGroupInput) => updateGroupForUser(ctx.user.id, input);
export const remove = (ctx: AuthedContext, id: string) => deleteGroupForUser(ctx.user.id, id);
export const addMembers = (ctx: AuthedContext, input: AddGroupMembersInput) => addGroupMembersForUser(ctx.user.id, input);
export const removeMember = (ctx: AuthedContext, groupId: string, userId: string) => removeGroupMemberForUser(ctx.user.id, groupId, userId);
export const leave = (ctx: AuthedContext, groupId: string) => removeGroupMemberForUser(ctx.user.id, groupId, ctx.user.publicId);
export const inviteLink = (ctx: AuthedContext, groupId: string) => getGroupInviteLinkForUser(ctx.user.id, groupId);
export const cancelInvite = (ctx: AuthedContext, groupId: string, inviteId: string) => cancelInviteForUser(ctx.user.id, groupId, inviteId);
export const previewInvite = (ctx: AuthedContext, code: string) => previewInviteForUser(ctx.user.id, code);
export const join = (ctx: AuthedContext, code: string) => joinGroupByCodeForUser(ctx.user.id, code);
export const contacts = (ctx: AuthedContext) => listContactsForUser(ctx.user.id);
