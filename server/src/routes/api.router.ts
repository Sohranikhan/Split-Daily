import { publicProcedure, router } from "../middleware/trpc";
import { accountRoutes } from "./api/account.routes";
import { authRoutes } from "./api/auth.routes";
import { dashboardRoutes } from "./api/dashboard.routes";
import { expenseRoutes } from "./api/expense.routes";
import { groupRoutes } from "./api/group.routes";
import { notificationRoutes } from "./api/notification.routes";
import { settlementRoutes } from "./api/settlement.routes";

/**
 * The app's API (/api/trpc/<area>.<action>). Each area's routes live in routes/api/*.routes.ts
 * and call the matching controller. The app imports this type for end-to-end type safety.
 */
export const appRouter = router({
  system: router({ health: publicProcedure.query(() => ({ ok: true as const })) }),
  auth: authRoutes,
  account: accountRoutes,
  dashboard: dashboardRoutes,
  groups: groupRoutes,
  expenses: expenseRoutes,
  settlements: settlementRoutes,
  notifications: notificationRoutes,
});

export type AppRouter = typeof appRouter;
