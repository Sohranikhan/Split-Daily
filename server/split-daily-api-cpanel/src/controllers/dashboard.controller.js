import { getDashboardForUser } from "../services/dashboard.service.js";
const summary = (ctx) => getDashboardForUser(ctx.user);
export {
  summary
};
