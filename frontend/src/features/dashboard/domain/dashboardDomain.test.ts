import { describe, expect, it } from "vitest";
import {
  activityView,
  areaGeometry,
  attentionView,
  dayPhase,
  delta,
  greeting,
  insightSentence,
  leadSentence,
  prevMonthName,
  smoothPath,
} from "./dashboardDomain";

describe("dashboard wording (D-153–D-157)", () => {
  it("delta pill is honest about missing comparisons", () => {
    expect(delta(15.4)).toEqual({ text: "↑ 15.4%", tone: "up" });
    expect(delta(-50)).toEqual({ text: "↓ 50%", tone: "down" });
    expect(delta(-5, true)).toEqual({ text: "↓ 5%", tone: "up" });
    expect(delta(null)).toEqual({ text: "—", tone: "flat" });
  });

  it("greets by the Amman hour", () => {
    expect(greeting(new Date("2026-11-22T06:00:00Z"))).toBe("صباح الخير"); // 09:00 in Amman
    expect(greeting(new Date("2026-11-22T10:00:00Z"))).toBe("مساء الخير"); // 13:00 in Amman
  });

  it("delivery scene sky follows the Amman hour", () => {
    expect(dayPhase(new Date("2026-11-22T04:00:00Z"))).toBe("morning"); // 07:00
    expect(dayPhase(new Date("2026-11-22T10:00:00Z"))).toBe("day"); // 13:00
    expect(dayPhase(new Date("2026-11-22T15:30:00Z"))).toBe("evening"); // 18:30
    expect(dayPhase(new Date("2026-11-22T20:00:00Z"))).toBe("night"); // 23:00
  });

  it("lead sentence and previous month name", () => {
    expect(
      leadSentence({
        products: 3,
        lowStock: 0,
        newOrders: 2,
        preparing: 1,
        courier: 0,
        deliveredThisMonth: 0,
        activeCustomers: 0,
      }),
    ).toBe("عندك 2 طلبات جديدة و1 بدها تجهيز. المخزون تمام.");
    expect(
      leadSentence({
        products: 3,
        lowStock: 2,
        newOrders: 0,
        preparing: 0,
        courier: 4,
        deliveredThisMonth: 0,
        activeCustomers: 0,
      }),
    ).toContain("، و4 مع المندوب. 2 منتجات قربت تخلص.");
    expect(prevMonthName("2026-01-01")).toBe("كانون الأول");
  });

  it("attention items link to the right screen", () => {
    const base = {
      priority: "low",
      count: null,
      amount: null,
      refId: null,
      name: null,
      orderNumber: null,
      since: null,
      available: null,
      threshold: null,
    } as const;
    expect(attentionView({ ...base, kind: "due", amount: "52.000", name: "رنا", refId: "c1" })).toMatchObject({
      title: "رنا عليه 52.00 د.أ",
      to: "/customers/c1",
    });
    expect(
      attentionView({ ...base, kind: "low_stock", name: "كريم", available: 0, threshold: 5, refId: "p1" }),
    ).toMatchObject({ title: "كريم · نفد", to: "/products/p1" });
    expect(
      activityView({
        kind: "movement",
        at: "",
        name: "كريم",
        number: null,
        amount: null,
        type: "receive",
        quantity: 10,
        label: "مورّد",
      }).title,
    ).toBe("استلام بضاعة · كريم");
  });

  it("insight sentence from rules", () => {
    expect(insightSentence({ topChannel: "instagram", topChannelShare: 80, topProduct: "كريم", bestWeekday: 4 })).toBe(
      "أكثر قناة بتبيع هالشهر «إنستغرام» (80%)، وأقوى يوم مبيعات عندك الخميس. منتجك الأول: «كريم».",
    );
    expect(insightSentence({ topChannel: null, topChannelShare: null, topProduct: null, bestWeekday: null })).toContain(
      "أول ما تتوصّل",
    );
  });
});

describe("chart geometry", () => {
  it("draws right to left with headroom and clips negative profit", () => {
    const g = areaGeometry(
      [
        { a: 0, b: 0 },
        { a: 100, b: -20 },
      ],
      640,
      220,
    );
    expect(g.x(0)).toBe(626); // oldest on the right
    expect(g.x(1)).toBe(14); // newest on the left
    expect(g.y(-20)).toBe(g.y(0)); // a loss sits on the baseline
    expect(g.max).toBeCloseTo(115);
    expect(
      smoothPath([
        [0, 0],
        [10, 10],
      ]),
    ).toBe("M0.0 0.0 C5.0 0.0 5.0 10.0 10.0 10.0");
  });
});
