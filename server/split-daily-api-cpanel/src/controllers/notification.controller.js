import { getNotificationsForUser, markAllNotificationsReadForUser, markNotificationReadForUser } from "../services/notification.service.js";
const list = (ctx) => getNotificationsForUser(ctx.user.id);
const markRead = (ctx, publicId) => markNotificationReadForUser(ctx.user.id, publicId);
const markAllRead = (ctx) => markAllNotificationsReadForUser(ctx.user.id);
export {
  list,
  markAllRead,
  markRead
};
