import { describe, expect, it } from "vitest";
import { trialStatus } from "./trial";

describe("trialStatus", () => {
  it("counts used days out of 30", () => {
    expect(trialStatus(30)).toEqual({ remaining: 30, used: 0, ended: false, isLate: false });
    expect(trialStatus(18)).toMatchObject({ used: 12, isLate: false });
  });

  it("is late in the last 3 days only", () => {
    expect(trialStatus(4).isLate).toBe(false);
    expect(trialStatus(3).isLate).toBe(true);
    expect(trialStatus(1).isLate).toBe(true);
  });

  it("ends at 0 days and clamps used days", () => {
    expect(trialStatus(0)).toEqual({ remaining: 0, used: 30, ended: true, isLate: false });
    expect(trialStatus(-2).used).toBe(30);
  });
});
