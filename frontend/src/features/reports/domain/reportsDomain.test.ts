import { describe, expect, it } from "vitest";
import type { PnlLines, ReportPeriod } from "../api/reportsApi";
import {
  bucketLabel,
  changeSentence,
  compareLabel,
  periodSearch,
  periodSubtitle,
  rangeLabel,
  readPeriod,
  shares,
  waterfallBars,
  waterfallSteps,
} from "./reportsDomain";

const period = (p: Partial<ReportPeriod>): ReportPeriod => ({
  period: "month",
  from: "2026-11-01",
  to: "2026-11-22",
  previousFrom: "2026-10-01",
  previousTo: "2026-10-22",
  includesToday: true,
  bucket: "day",
  ...p,
});

describe("report period in the URL (D-168)", () => {
  it("reads presets and complete custom ranges, falls back to this month", () => {
    expect(readPeriod(new URLSearchParams("period=last_7_days"))).toEqual({ period: "last_7_days" });
    expect(readPeriod(new URLSearchParams("period=custom&from=2026-11-01&to=2026-11-10"))).toEqual({
      period: "custom",
      from: "2026-11-01",
      to: "2026-11-10",
    });
    expect(readPeriod(new URLSearchParams("period=custom&from=2026-11-01"))).toEqual({ period: "month" });
    expect(readPeriod(new URLSearchParams("period=year"))).toEqual({ period: "month" });
    expect(readPeriod(new URLSearchParams(""))).toEqual({ period: "month" });
  });

  it("writes the query string the API reads", () => {
    expect(periodSearch({ period: "month" })).toBe("period=month");
    expect(periodSearch({ period: "custom", from: "2026-11-01", to: "2026-11-10" })).toBe("period=custom&from=2026-11-01&to=2026-11-10");
  });

  it("describes the period and its comparison", () => {
    expect(periodSubtitle(period({}))).toBe("تشرين الثاني حتى اليوم، مقارنة بنفس الفترة من تشرين الأول");
    expect(compareLabel(period({}))).toBe("مقارنة بنفس الفترة من تشرين الأول");
    expect(compareLabel(period({ period: "last_month", from: "2026-10-01", previousFrom: "2026-09-01" }))).toBe("مقارنة بأيلول");
    expect(rangeLabel("2026-11-01", "2026-11-19")).toBe("1 – 19 تشرين الثاني");
    expect(rangeLabel("2026-10-20", "2026-11-05")).toBe("20 تشرين الأول – 5 تشرين الثاني");
  });

  it("labels today and month buckets", () => {
    expect(bucketLabel("2026-11-22", period({}))).toBe("اليوم");
    expect(bucketLabel("2026-11-22", period({ includesToday: false }))).not.toBe("اليوم");
    expect(bucketLabel("2026-01-01", period({ bucket: "month" }))).toContain("26");
  });
});

describe("«شو تغيّر؟» sentence (D-170)", () => {
  it("names the change in net profit and its largest driver", () => {
    expect(
      changeSentence({ hasPrevious: true, netProfitChange: "120.000", driver: { kind: "sales", categoryName: null, categoryCode: null, change: "200.000", effect: "200.000" } }),
    ).toBe("صافي الربح زاد 120.00 د.أ، وأكبر سبب إن المبيعات زادت 200.00 د.أ.");
    expect(
      changeSentence({ hasPrevious: true, netProfitChange: "-20.000", driver: { kind: "expense", categoryName: "إعلانات", categoryCode: "ads", change: "20.000", effect: "-20.000" } }),
    ).toBe("صافي الربح نقص 20.00 د.أ، وأكبر سبب إن مصاريف «إعلانات» زادت 20.00 د.أ.");
    expect(
      changeSentence({ hasPrevious: true, netProfitChange: "0.000", driver: { kind: "cogs", categoryName: null, categoryCode: null, change: "-5.000", effect: "5.000" } }),
    ).toBe("صافي الربح ما تغيّر، بس تكلفة البضاعة نقصت 5.00 د.أ.");
  });

  it("is honest without a comparison or a change", () => {
    expect(changeSentence({ hasPrevious: false, netProfitChange: "10.000", driver: null })).toBe("ما في فترة سابقة للمقارنة.");
    expect(changeSentence({ hasPrevious: true, netProfitChange: "0.000", driver: null })).toBe("صافي الربح ما تغيّر عن الفترة السابقة.");
  });
});

describe("waterfall", () => {
  const lines: PnlLines = {
    sales: "41.000",
    deliveredCount: 1,
    returns: "14.620",
    netSales: "26.380",
    cogs: "12.000",
    grossProfit: "14.380",
    expenses: "4.000",
    netProfit: "10.380",
  };

  it("goes from sales to net and drops empty out-steps", () => {
    const steps = waterfallSteps({ ...lines, returns: "0.000" }, [{ name: "إعلانات", current: "4.000" }]);
    expect(steps.map((s) => s.label)).toEqual(["المبيعات", "تكلفة البضاعة", "إجمالي الربح", "إعلانات", "صافي الربح"]);
    expect(steps.map((s) => s.value)).toEqual([41000, -12000, 14380, -4000, 10380]);
  });

  it("draws right to left and scales a loss below zero", () => {
    const steps = waterfallSteps({ ...lines, netProfit: "-5.000", grossProfit: "14.380" }, [{ name: "إيجار", current: "19.380" }]);
    const { bars, zero } = waterfallBars(steps, 760, 280);
    expect(bars[0]!.cx).toBeGreaterThan(bars[bars.length - 1]!.cx); // first step on the right
    const net = bars[bars.length - 1]!;
    expect(net.top).toBeCloseTo(zero); // a loss hangs below the zero line
    expect(net.height).toBeGreaterThan(2);
  });
});

it("shares are whole percents of positive amounts", () => {
  expect(shares(["30.000", "10.000", "-5.000"])).toEqual([75, 25, 0]);
  expect(shares(["0.000"])).toEqual([0]);
});
