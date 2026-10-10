import * as dashboard from "../../controllers/dashboard.controller.js";
import { protectedProcedure, router } from "../../middleware/trpc.js";
const dashboardRoutes = router({
  summary: protectedProcedure.query(({ ctx }) => dashboard.summary(ctx))
});
export {
  dashboardRoutes
};
