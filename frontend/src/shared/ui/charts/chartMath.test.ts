import { describe, expect, it } from "vitest";
import { areaGeometry, delta, showLabel, smoothPath } from "./chartMath";

describe("delta", () => {
  it("delta pill is honest about missing comparisons", () => {
    expect(delta(15.4)).toEqual({ text: "↑ 15.4%", tone: "up" });
    expect(delta(-50)).toEqual({ text: "↓ 50%", tone: "down" });
    expect(delta(-5, true)).toEqual({ text: "↓ 5%", tone: "up" });
    expect(delta(null)).toEqual({ text: "—", tone: "flat" });
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

describe("axis labels", () => {
  it("never puts a regular label next to the last one", () => {
    const shown = (count: number) => Array.from({ length: count }, (_, i) => i).filter((i) => showLabel(i, count, Math.ceil(count / 7)));
    expect(shown(22)).toEqual([0, 4, 8, 12, 16, 21]);
    expect(shown(14)).toEqual([0, 2, 4, 6, 8, 10, 13]);
    expect(shown(7)).toEqual([0, 1, 2, 3, 4, 5, 6]); // one label per point fits
    expect(shown(1)).toEqual([0]);
  });
});
