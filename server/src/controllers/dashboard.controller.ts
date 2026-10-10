import type { AuthedContext } from "../middleware/trpc";
import { getDashboardForUser } from "../services/dashboard.service";

/** Home screen: balances, people, groups and recent activity. */
export const summary = (ctx: AuthedContext) => getDashboardForUser(ctx.user);
