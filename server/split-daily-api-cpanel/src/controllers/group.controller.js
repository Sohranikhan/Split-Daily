import { getDashboardForUser } from "../services/dashboard.service.js";
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
  updateGroupForUser
} from "../services/group.service.js";
const list = async (ctx) => (await getDashboardForUser(ctx.user)).groups;
const get = (ctx, id) => getGroupForUser(ctx.user.id, id);
const create = (ctx, input) => createGroupForUser(ctx.user.id, input);
const update = (ctx, input) => updateGroupForUser(ctx.user.id, input);
const remove = (ctx, id) => deleteGroupForUser(ctx.user.id, id);
const addMembers = (ctx, input) => addGroupMembersForUser(ctx.user.id, input);
const removeMember = (ctx, groupId, userId) => removeGroupMemberForUser(ctx.user.id, groupId, userId);
const leave = (ctx, groupId) => removeGroupMemberForUser(ctx.user.id, groupId, ctx.user.publicId);
const inviteLink = (ctx, groupId) => getGroupInviteLinkForUser(ctx.user.id, groupId);
const cancelInvite = (ctx, groupId, inviteId) => cancelInviteForUser(ctx.user.id, groupId, inviteId);
const previewInvite = (ctx, code) => previewInviteForUser(ctx.user.id, code);
const join = (ctx, code) => joinGroupByCodeForUser(ctx.user.id, code);
const contacts = (ctx) => listContactsForUser(ctx.user.id);
export {
  addMembers,
  cancelInvite,
  contacts,
  create,
  get,
  inviteLink,
  join,
  leave,
  list,
  previewInvite,
  remove,
  removeMember,
  update
};
