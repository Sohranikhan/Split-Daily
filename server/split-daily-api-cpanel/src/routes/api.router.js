import { publicProcedure, router } from "../middleware/trpc.js";
import { accountRoutes } from "./api/account.routes.js";
import { authRoutes } from "./api/auth.routes.js";
import { dashboardRoutes } from "./api/dashboard.routes.js";
import { expenseRoutes } from "./api/expense.routes.js";
import { groupRoutes } from "./api/group.routes.js";
import { notificationRoutes } from "./api/notification.routes.js";
import { settlementRoutes } from "./api/settlement.routes.js";
const appRouter = router({
  system: router({ health: publicProcedure.query(() => ({ ok: true })) }),
  auth: authRoutes,
  account: accountRoutes,
  dashboard: dashboardRoutes,
  groups: groupRoutes,
  expenses: expenseRoutes,
  settlements: settlementRoutes,
  notifications: notificationRoutes
});
export {
  appRouter
};
