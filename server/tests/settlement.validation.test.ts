import { describe, expect, it } from "vitest";
import { createSettlementInputSchema } from "../../shared/domain";

describe("settlement input validation", () => {
  it("rejects zero or negative settlement amounts", () => {
    expect(() => createSettlementInputSchema.parse({ payerId: "1", receiverId: "2", amountMinor: 0, currency: "USD" })).toThrow();
  });

  it("defaults the payment method", () => {
    const value = createSettlementInputSchema.parse({ payerId: "1", receiverId: "2", amountMinor: 5000, currency: "USD" });
    expect(value.paymentMethod).toBe("Other");
  });
});
