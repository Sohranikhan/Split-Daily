import { getDashboardForUser } from "../services/dashboard.service.js";
import { createExpenseForUser, deleteExpenseForUser, getExpenseForUser, listExpensesForUser, updateExpenseForUser } from "../services/expense.service.js";
const list = (ctx, options) => listExpensesForUser(ctx.user.id, options);
const recent = async (ctx) => (await getDashboardForUser(ctx.user)).activity.filter((item) => item.kind === "expense");
const get = (ctx, id) => getExpenseForUser(ctx.user.id, id);
const create = (ctx, input) => createExpenseForUser(ctx.user.id, input);
const update = (ctx, input) => updateExpenseForUser(ctx.user.id, input);
const remove = (ctx, id) => deleteExpenseForUser(ctx.user.id, id);
export {
  create,
  get,
  list,
  recent,
  remove,
  update
};
