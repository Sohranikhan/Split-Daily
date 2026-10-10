import { z } from "zod";
import { updateNotificationPreferencesInputSchema, updateProfileInputSchema } from "../../../../shared/domain";
import * as account from "../../controllers/account.controller";
import { protectedProcedure, router } from "../../middleware/trpc";

export const accountRoutes = router({
  settings: protectedProcedure.query(({ ctx }) => account.settings(ctx)),
  updateProfile: protectedProcedure.input(updateProfileInputSchema).mutation(({ ctx, input }) => account.updateProfile(ctx, input)),
  updateNotifications: protectedProcedure.input(updateNotificationPreferencesInputSchema).mutation(({ ctx, input }) => account.updateNotifications(ctx, input)),
  delete: protectedProcedure.input(z.object({ confirm: z.literal("DELETE") })).mutation(({ ctx }) => account.remove(ctx)),
});
