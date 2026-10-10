import type { CreateSettlementInput, UpdateSettlementStatusInput } from "../../../shared/domain";
import type { AuthedContext } from "../middleware/trpc";
import { createSettlementForUser, listSettlementsForUser, updateSettlementStatusForUser } from "../services/settlement.service";

/** Payments between people ("settle up"). */
export const list = (ctx: AuthedContext) => listSettlementsForUser(ctx.user.id);
export const create = (ctx: AuthedContext, input: CreateSettlementInput) => createSettlementForUser(ctx.user.id, input);
export const updateStatus = (ctx: AuthedContext, input: UpdateSettlementStatusInput) => updateSettlementStatusForUser(ctx.user.id, input);
