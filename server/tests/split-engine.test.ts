import { describe, expect, it } from "vitest";
import { calculateDebts, calculateSplit, simplifyDebts, SplitValidationError } from "../../shared/finance/split-engine";

describe("calculateSplit", () => {
  it("splits equal amounts in minor units and distributes remainder deterministically", () => {
    expect(calculateSplit(10001, ["a", "b", "c"], "equal").map((line) => line.amountMinor)).toEqual([3334, 3334, 3333]);
  });

  it("validates exact amounts", () => {
    expect(() => calculateSplit(100, ["a", "b"], "exact", { a: 60, b: 30 })).toThrow(SplitValidationError);
    expect(calculateSplit(100, ["a", "b"], "exact", { a: 60, b: 40 }).map((line) => line.amountMinor)).toEqual([60, 40]);
  });

  it("calculates percentage and shares", () => {
    expect(calculateSplit(1000, ["a", "b"], "percentage", { a: 25, b: 75 }).map((line) => line.amountMinor)).toEqual([250, 750]);
    expect(calculateSplit(1000, ["a", "b", "c"], "shares", { a: 2, b: 1, c: 1 }).map((line) => line.amountMinor)).toEqual([500, 250, 250]);
  });
});

describe("calculateDebts", () => {
  it("nets payer contributions against participant shares", () => {
    expect(calculateDebts(
      [{ userId: "a", amountMinor: 8000 }],
      [{ userId: "a", amountMinor: 4000 }, { userId: "b", amountMinor: 4000 }],
      "USD",
    )).toEqual([{ fromId: "b", toId: "a", amountMinor: 4000, currency: "USD" }]);
  });
});

describe("simplifyDebts", () => {
  it("collapses pass-through debts", () => {
    expect(simplifyDebts([
      { fromId: "a", toId: "b", amountMinor: 5000, currency: "USD" },
      { fromId: "b", toId: "c", amountMinor: 5000, currency: "USD" },
    ])).toEqual([{ fromId: "a", toId: "c", amountMinor: 5000, currency: "USD" }]);
  });
});
