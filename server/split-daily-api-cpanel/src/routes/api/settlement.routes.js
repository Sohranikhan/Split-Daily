import { createSettlementInputSchema, updateSettlementStatusInputSchema } from "../../../shared/domain.js";
import * as settlements from "../../controllers/settlement.controller.js";
import { protectedProcedure, router } from "../../middleware/trpc.js";
const settlementRoutes = router({
  list: protectedProcedure.query(({ ctx }) => settlements.list(ctx)),
  create: protectedProcedure.input(createSettlementInputSchema).mutation(({ ctx, input }) => settlements.create(ctx, input)),
  updateStatus: protectedProcedure.input(updateSettlementStatusInputSchema).mutation(({ ctx, input }) => settlements.updateStatus(ctx, input))
});
export {
  settlementRoutes
};
