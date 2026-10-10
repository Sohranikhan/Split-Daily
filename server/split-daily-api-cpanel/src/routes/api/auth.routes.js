import { revokeSession } from "../../services/auth/session.service.js";
import { publicProcedure, router } from "../../middleware/trpc.js";
import { toPublicUser } from "../../views/user.view.js";
const authRoutes = router({
  me: publicProcedure.query(({ ctx }) => ctx.user ? toPublicUser(ctx.user) : null),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.sessionId) await revokeSession(ctx.sessionId);
    return { success: true };
  })
});
export {
  authRoutes
};
