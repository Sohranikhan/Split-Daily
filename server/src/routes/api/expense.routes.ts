import { z } from "zod";
import { createExpenseInputSchema, updateExpenseInputSchema } from "../../../../shared/domain";
import * as expenses from "../../controllers/expense.controller";
import { protectedProcedure, router } from "../../middleware/trpc";

const idInput = z.object({ id: z.string().min(1) });

export const expenseRoutes = router({
  list: protectedProcedure.input(z.object({ groupId: z.string().min(1).optional(), limit: z.number().int().min(1).max(200).optional() }).optional()).query(({ ctx, input }) => expenses.list(ctx, input ?? {})),
  recent: protectedProcedure.query(({ ctx }) => expenses.recent(ctx)),
  get: protectedProcedure.input(idInput).query(({ ctx, input }) => expenses.get(ctx, input.id)),
  create: protectedProcedure.input(createExpenseInputSchema).mutation(({ ctx, input }) => expenses.create(ctx, input)),
  update: protectedProcedure.input(updateExpenseInputSchema).mutation(({ ctx, input }) => expenses.update(ctx, input)),
  delete: protectedProcedure.input(idInput).mutation(({ ctx, input }) => expenses.remove(ctx, input.id)),
});
