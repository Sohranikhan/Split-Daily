import * as dashboard from "../../controllers/dashboard.controller";
import { protectedProcedure, router } from "../../middleware/trpc";

export const dashboardRoutes = router({
  summary: protectedProcedure.query(({ ctx }) => dashboard.summary(ctx)),
});
