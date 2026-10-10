import { revokeSession } from "../../services/auth/session.service";
import { publicProcedure, router } from "../../middleware/trpc";
import { toPublicUser } from "../../views/user.view";

export const authRoutes = router({
  me: publicProcedure.query(({ ctx }) => (ctx.user ? toPublicUser(ctx.user) : null)),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.sessionId) await revokeSession(ctx.sessionId);
    return { success: true } as const;
  }),
});
