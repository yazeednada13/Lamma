import { describe, expect, it } from "vitest";
import { barWidths, expenseInsight, groupByDay, percentShares, periodRange, settlementPreview } from "./financeDomain";

describe("settlement math (D-141)", () => {
  it("adds the picked orders and books the difference", () => {
    expect(settlementPreview(["11.000", "21.000"], "30")).toEqual({
      expected: "32.000",
      received: "30.000",
      difference: "2.000",
    });
    expect(settlementPreview(["11.000"], "11").difference).toBe("0.000");
    expect(settlementPreview(["11.000"], "0")).toEqual({ expected: "11.000", received: "0.000", difference: "11.000" });
  });

  it("rejects more than expected, junk, empty and no orders", () => {
    for (const input of ["11.01", "abc", "", "1.005"]) {
      expect(settlementPreview(["11.000"], input).received).toBeNull();
    }
    expect(settlementPreview([], "0").error).toBe("اختار طلب واحد على الأقل.");
  });
});

describe("periods in Asia/Amman (D-124)", () => {
  it("this month to date and the whole previous month", () => {
    const now = new Date("2026-11-30T22:30:00Z"); // already 1 December in Amman
    expect(periodRange("month", now)).toEqual({ from: "2026-12-01", to: "2026-12-01" });
    expect(periodRange("last_month", now)).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(periodRange("last_month", new Date("2026-01-10T10:00:00Z"))).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});

describe("shares and grouping", () => {
  it("percent shares and bar widths", () => {
    expect(percentShares(["30.000", "10.000"])).toEqual([75, 25]);
    expect(percentShares(["0.000"])).toEqual([0]);
    expect(barWidths(["30.000", "15.000"])).toEqual([100, 50]);
  });

  it("groups by day, newest first", () => {
    const groups = groupByDay([{ d: "2026-11-20" }, { d: "2026-11-21" }, { d: "2026-11-20" }], (x) => x.d);
    expect(groups.map((g) => [g.day, g.items.length])).toEqual([
      ["2026-11-21", 1],
      ["2026-11-20", 2],
    ]);
  });

  it("insight names the biggest category and the share of sales", () => {
    expect(expenseInsight({ name: "إعلانات", amount: "30.000" }, "40.000", "200.000")).toBe(
      "أكبر مصروف «إعلانات» بنسبة 75% من المصاريف. المصاريف بتاكل 20% من مبيعاتك.",
    );
    expect(expenseInsight(undefined, "0.000")).toBe("لسا ما سجّلت مصاريف بهالفترة.");
  });
});
