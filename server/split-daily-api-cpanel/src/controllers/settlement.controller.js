import { createSettlementForUser, listSettlementsForUser, updateSettlementStatusForUser } from "../services/settlement.service.js";
const list = (ctx) => listSettlementsForUser(ctx.user.id);
const create = (ctx, input) => createSettlementForUser(ctx.user.id, input);
const updateStatus = (ctx, input) => updateSettlementStatusForUser(ctx.user.id, input);
export {
  create,
  list,
  updateStatus
};
