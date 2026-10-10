import type { NotificationPreferences, UpdateProfileInput } from "../../../shared/domain";
import type { AuthedContext } from "../middleware/trpc";
import { deleteAccountForUser, getSettingsForUser, updateNotificationPreferencesForUser, updateProfileForUser } from "../services/account.service";

/** Account & settings: profile, default currency, notification preferences, deletion. */
export const settings = (ctx: AuthedContext) => getSettingsForUser(ctx.user);
export const updateProfile = (ctx: AuthedContext, input: UpdateProfileInput) => updateProfileForUser(ctx.user.id, input);
export const updateNotifications = (ctx: AuthedContext, input: Partial<NotificationPreferences>) => updateNotificationPreferencesForUser(ctx.user.id, input);
export const remove = (ctx: AuthedContext) => deleteAccountForUser(ctx.user.id);
