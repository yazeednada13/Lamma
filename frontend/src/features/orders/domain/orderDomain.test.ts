import { describe, expect, it } from "vitest";
import { cancelProblem, clampQuantity, computeReceipt, flowIndex, isReserving, presetRange, statusMessage, undoSecondsLeft } from "./orderDomain";

describe("order receipt", () => {
  it("computes total and profit in fils like the server (D-031, D-125)", () => {
    const receipt = computeReceipt(
      [
        { quantity: 3, unitPrice: "12.500", unitCost: "5.000" },
        { quantity: 1, unitPrice: "0.100", unitCost: "0.033" },
      ],
      "2.500",
      "1.500",
    );
    expect(receipt).toEqual({ subtotal: "37.600", total: "38.600", itemsCost: "15.033", profit: "21.067", discountTooHigh: false });
  });

  it("flags a discount above the items subtotal (D-126)", () => {
    expect(computeReceipt([{ quantity: 1, unitPrice: "10.000", unitCost: "4.000" }], "0", "10.010").discountTooHigh).toBe(true);
    expect(computeReceipt([], "2.000", "0").total).toBe("2.000");
  });
});

describe("order rules", () => {
  it("knows the reserving statuses and the flow position", () => {
    expect(["new", "confirmed", "preparing", "courier", "delivered", "cancelled"].map((s) => isReserving(s as never))).toEqual([false, true, true, true, false, false]);
    expect(flowIndex("courier")).toBe(3);
    expect(flowIndex("cancelled")).toBe(-1);
  });

  it("requires a note only for «other» and caps quantities at the available stock", () => {
    expect(cancelProblem("other", "  ")).toBe("اكتب سبب الإلغاء.");
    expect(cancelProblem("no_answer", "")).toBeNull();
    expect(cancelProblem("changed_mind", "x".repeat(201))).not.toBeNull();
    expect([clampQuantity(5, 3), clampQuantity(0, 3), clampQuantity(2, 0)]).toEqual([3, 1, 1]);
  });

  it("words the toast per status and counts down the undo window", () => {
    expect(statusMessage(1001, "confirmed")).toContain("#1001");
    expect(undoSecondsLeft("2026-11-20T10:05:00Z", Date.parse("2026-11-20T10:03:30Z"))).toBe(90);
    expect(undoSecondsLeft("2026-11-20T10:05:00Z", Date.parse("2026-11-20T10:06:00Z"))).toBe(0);
  });
});

describe("business-local date presets (D-124)", () => {
  it("uses the Amman day, not the UTC day", () => {
    const lateEvening = new Date("2026-11-20T22:30:00Z"); // 01:30 on 21 Nov in Amman (UTC+3)
    expect(presetRange("today", lateEvening)).toEqual({ from: "2026-11-21", to: "2026-11-21" });
    expect(presetRange("week", lateEvening)).toEqual({ from: "2026-11-15", to: "2026-11-21" });
    expect(presetRange("month", lateEvening)).toEqual({ from: "2026-11-01", to: "2026-11-21" });
    expect(presetRange("all", lateEvening)).toEqual({});
  });
});
