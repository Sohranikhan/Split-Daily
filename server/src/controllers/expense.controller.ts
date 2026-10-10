import type { CreateExpenseInput, UpdateExpenseInput } from "../../../shared/domain";
import type { AuthedContext } from "../middleware/trpc";
import { getDashboardForUser } from "../services/dashboard.service";
import { createExpenseForUser, deleteExpenseForUser, getExpenseForUser, listExpensesForUser, updateExpenseForUser } from "../services/expense.service";

/** Expenses: list, detail, add, edit and delete (edit/delete only by the person who added it). */
export const list = (ctx: AuthedContext, options: { groupId?: string; limit?: number }) => listExpensesForUser(ctx.user.id, options);
/** Kept for older app builds. */
export const recent = async (ctx: AuthedContext) => (await getDashboardForUser(ctx.user)).activity.filter((item) => item.kind === "expense");
export const get = (ctx: AuthedContext, id: string) => getExpenseForUser(ctx.user.id, id);
export const create = (ctx: AuthedContext, input: CreateExpenseInput) => createExpenseForUser(ctx.user.id, input);
export const update = (ctx: AuthedContext, input: UpdateExpenseInput) => updateExpenseForUser(ctx.user.id, input);
export const remove = (ctx: AuthedContext, id: string) => deleteExpenseForUser(ctx.user.id, id);
