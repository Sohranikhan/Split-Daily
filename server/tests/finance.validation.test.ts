import { describe, expect, it } from "vitest";
import { createExpenseInputSchema } from "../../shared/domain";

describe("shared finance input validation", () => {
  it("requires a positive amount and at least one participant", () => {
    expect(() => createExpenseInputSchema.parse({ description: "Dinner", amountMinor: 0, currency: "USD", splitMethod: "equal", payerIds: [], participantIds: [], values: {} })).toThrow();
  });

  it("defaults payer amounts to an empty map for the service to resolve", () => {
    const value = createExpenseInputSchema.parse({ description: "Dinner", amountMinor: 12000, currency: "USD", splitMethod: "equal", payerIds: ["1"], participantIds: ["1"], values: {} });
    expect(value.payerAmounts).toEqual({});
  });
});
