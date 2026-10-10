import { z } from "zod";
import * as notifications from "../../controllers/notification.controller";
import { protectedProcedure, router } from "../../middleware/trpc";

export const notificationRoutes = router({
  list: protectedProcedure.query(({ ctx }) => notifications.list(ctx)),
  markRead: protectedProcedure.input(z.object({ publicId: z.string().min(1) })).mutation(({ ctx, input }) => notifications.markRead(ctx, input.publicId)),
  markAllRead: protectedProcedure.mutation(({ ctx }) => notifications.markAllRead(ctx)),
});
