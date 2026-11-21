import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useActionKey } from "../api/inventoryApi";
import { adjustPreview, groupByDay, reasonsFor, receiptTotals, weightedCostPreview } from "./inventoryDomain";

describe("inventory rules shown in the UI", () => {
  it("offers every reason for a decrease and only count/correction for an increase (D-110)", () => {
    expect(reasonsFor(false).map((r) => r.code)).toEqual(["damage", "loss", "count", "correction", "gift"]);
    expect(reasonsFor(true).map((r) => r.code)).toEqual(["count", "correction"]);
  });

  it("previews the result and blocks going below the reserved pieces", () => {
    expect(adjustPreview(5, 0, -2)).toEqual({ after: 3, belowReserved: false });
    expect(adjustPreview(5, 2, -4)).toEqual({ after: 1, belowReserved: true });
    expect(adjustPreview(1, 0, -2)).toEqual({ after: -1, belowReserved: true });
  });

  it("totals a receipt in integer fils and ignores invalid costs", () => {
    expect(
      receiptTotals([
        { quantity: 3, unitCost: "0.1" },
        { quantity: 10, unitCost: "8.25" },
      ]),
    ).toEqual({ pieces: 13, total: "82.800" });
    expect(receiptTotals([{ quantity: 2, unitCost: "x" }])).toEqual({ pieces: 2, total: "0.000" });
  });

  it("previews the weighted-average cost like the server (D-109)", () => {
    expect(weightedCostPreview(10, "4.000", 10, "5")).toBe("4.500");
    expect(weightedCostPreview(2, "3.000", 1, "4")).toBe("3.333"); // 10 / 3, rounded to the fils
    expect(weightedCostPreview(0, "4.000", 5, "6.5")).toBe("6.500"); // no stock: the new cost applies
    expect(weightedCostPreview(10, "4.000", 10, "abc")).toBeNull();
  });

  it("groups movements by their day in Asia/Amman with today and yesterday labels", () => {
    const now = new Date("2026-11-18T10:00:00Z"); // 13:00 in Amman
    const groups = groupByDay(
      [
        { id: 1, createdAt: "2026-11-18T09:00:00Z" },
        { id: 2, createdAt: "2026-11-17T21:30:00Z" }, // 00:30 on the 18th in Amman
        { id: 3, createdAt: "2026-11-17T08:00:00Z" },
        { id: 4, createdAt: "2026-11-10T08:00:00Z" },
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["اليوم", [1, 2]],
      ["أمس", [3]],
      ["10 تشرين الثاني", [4]],
    ]);
  });

  it("reuses one idempotency key for retries of the same request and renews it for a changed one (D-112)", () => {
    const { result } = renderHook(() => useActionKey());
    const first = result.current.keyFor({ variantId: "v1", delta: -1 });
    expect(result.current.keyFor({ variantId: "v1", delta: -1 })).toBe(first);
    const changed = result.current.keyFor({ variantId: "v1", delta: -2 });
    expect(changed).not.toBe(first);
    result.current.done();
    expect(result.current.keyFor({ variantId: "v1", delta: -2 })).not.toBe(changed);
  });
});
