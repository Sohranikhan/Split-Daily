import { deleteAccountForUser, getSettingsForUser, updateNotificationPreferencesForUser, updateProfileForUser } from "../services/account.service.js";
const settings = (ctx) => getSettingsForUser(ctx.user);
const updateProfile = (ctx, input) => updateProfileForUser(ctx.user.id, input);
const updateNotifications = (ctx, input) => updateNotificationPreferencesForUser(ctx.user.id, input);
const remove = (ctx) => deleteAccountForUser(ctx.user.id);
export {
  remove,
  settings,
  updateNotifications,
  updateProfile
};
