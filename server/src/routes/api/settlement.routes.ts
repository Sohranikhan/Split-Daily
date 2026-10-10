import { createSettlementInputSchema, updateSettlementStatusInputSchema } from "../../../../shared/domain";
import * as settlements from "../../controllers/settlement.controller";
import { protectedProcedure, router } from "../../middleware/trpc";

export const settlementRoutes = router({
  list: protectedProcedure.query(({ ctx }) => settlements.list(ctx)),
  create: protectedProcedure.input(createSettlementInputSchema).mutation(({ ctx, input }) => settlements.create(ctx, input)),
  updateStatus: protectedProcedure.input(updateSettlementStatusInputSchema).mutation(({ ctx, input }) => settlements.updateStatus(ctx, input)),
});
