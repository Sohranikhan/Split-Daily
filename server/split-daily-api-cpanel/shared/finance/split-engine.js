class SplitValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "SplitValidationError";
  }
}
function assertFinitePositive(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new SplitValidationError(`${label} must be greater than zero.`);
  }
}
function allocateRemainder(amountMinor, weights) {
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  if (weightTotal <= 0) throw new SplitValidationError("At least one participant must have a value.");
  const exact = weights.map((weight) => amountMinor * weight / weightTotal);
  const floors = exact.map(Math.floor);
  let remainder = amountMinor - floors.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, fraction: value - floors[index] })).sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let cursor = 0; cursor < order.length && remainder > 0; cursor += 1) {
    floors[order[cursor].index] += 1;
    remainder -= 1;
  }
  return floors;
}
function calculateSplit(amountMinor, participantIds, method, values = {}) {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new SplitValidationError("Amount must be a positive integer number of minor units.");
  }
  if (participantIds.length === 0 || new Set(participantIds).size !== participantIds.length) {
    throw new SplitValidationError("Participants must be unique and include at least one person.");
  }
  if (method === "equal") {
    return participantIds.map((participantId, index) => ({
      participantId,
      value: 1,
      amountMinor: Math.floor(amountMinor / participantIds.length) + (index < amountMinor % participantIds.length ? 1 : 0)
    }));
  }
  const weights = participantIds.map((participantId) => {
    const value = values[participantId];
    if (value === void 0) throw new SplitValidationError(`Missing value for ${participantId}.`);
    assertFinitePositive(value, `Value for ${participantId}`);
    return value;
  });
  if (method === "exact") {
    const total = weights.reduce((sum, value) => sum + value, 0);
    if (Math.round(total) !== amountMinor) {
      throw new SplitValidationError("Exact amounts must add up to the expense total.");
    }
    return participantIds.map((participantId, index) => ({
      participantId,
      value: weights[index],
      amountMinor: Math.round(weights[index])
    }));
  }
  if (method === "percentage") {
    const total = weights.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 100) > 1e-4) {
      throw new SplitValidationError("Percentages must add up to 100%.");
    }
  }
  const amounts = allocateRemainder(amountMinor, weights);
  return participantIds.map((participantId, index) => ({
    participantId,
    value: weights[index],
    amountMinor: amounts[index]
  }));
}
function calculateDebts(payers, shares, currency) {
  const net = /* @__PURE__ */ new Map();
  for (const payer of payers) {
    if (!Number.isInteger(payer.amountMinor) || payer.amountMinor < 0) {
      throw new SplitValidationError("Payer amounts must be non-negative minor units.");
    }
    net.set(payer.userId, (net.get(payer.userId) ?? 0) + payer.amountMinor);
  }
  for (const share of shares) {
    if (!Number.isInteger(share.amountMinor) || share.amountMinor < 0) {
      throw new SplitValidationError("Share amounts must be non-negative minor units.");
    }
    net.set(share.userId, (net.get(share.userId) ?? 0) - share.amountMinor);
  }
  const creditors = [...net.entries()].filter(([, amount]) => amount > 0).map(([userId, amountMinor]) => ({ userId, amountMinor })).sort((a, b) => b.amountMinor - a.amountMinor);
  const debtors = [...net.entries()].filter(([, amount]) => amount < 0).map(([userId, amount]) => ({ userId, amountMinor: Math.abs(amount) })).sort((a, b) => b.amountMinor - a.amountMinor);
  const debts = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amountMinor = Math.min(creditor.amountMinor, debtor.amountMinor);
    if (amountMinor > 0 && creditor.userId !== debtor.userId) {
      debts.push({ fromId: debtor.userId, toId: creditor.userId, amountMinor, currency });
    }
    creditor.amountMinor -= amountMinor;
    debtor.amountMinor -= amountMinor;
    if (creditor.amountMinor === 0) creditorIndex += 1;
    if (debtor.amountMinor === 0) debtorIndex += 1;
  }
  return debts;
}
function simplifyDebts(debts) {
  if (debts.length === 0) return [];
  const byCurrency = /* @__PURE__ */ new Map();
  for (const debt of debts) {
    const group = byCurrency.get(debt.currency) ?? [];
    group.push(debt);
    byCurrency.set(debt.currency, group);
  }
  const simplified = [];
  for (const [currency, currencyDebts] of byCurrency) {
    const net = /* @__PURE__ */ new Map();
    for (const debt of currencyDebts) {
      net.set(debt.fromId, (net.get(debt.fromId) ?? 0) - debt.amountMinor);
      net.set(debt.toId, (net.get(debt.toId) ?? 0) + debt.amountMinor);
    }
    const payers = [...net.entries()].filter(([, value]) => value < 0).map(([userId, value]) => ({ userId, amountMinor: Math.abs(value) }));
    const receivers = [...net.entries()].filter(([, value]) => value > 0).map(([userId, value]) => ({ userId, amountMinor: value }));
    let payerIndex = 0;
    let receiverIndex = 0;
    while (payerIndex < payers.length && receiverIndex < receivers.length) {
      const payer = payers[payerIndex];
      const receiver = receivers[receiverIndex];
      const amountMinor = Math.min(payer.amountMinor, receiver.amountMinor);
      if (amountMinor > 0) simplified.push({ fromId: payer.userId, toId: receiver.userId, amountMinor, currency });
      payer.amountMinor -= amountMinor;
      receiver.amountMinor -= amountMinor;
      if (payer.amountMinor === 0) payerIndex += 1;
      if (receiver.amountMinor === 0) receiverIndex += 1;
    }
  }
  return simplified;
}
export {
  SplitValidationError,
  calculateDebts,
  calculateSplit,
  simplifyDebts
};
