import type { AuthedContext } from "../middleware/trpc";
import { getNotificationsForUser, markAllNotificationsReadForUser, markNotificationReadForUser } from "../services/notification.service";

/** In-app notifications (Activity tab). */
export const list = (ctx: AuthedContext) => getNotificationsForUser(ctx.user.id);
export const markRead = (ctx: AuthedContext, publicId: string) => markNotificationReadForUser(ctx.user.id, publicId);
export const markAllRead = (ctx: AuthedContext) => markAllNotificationsReadForUser(ctx.user.id);
