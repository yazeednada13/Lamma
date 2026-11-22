import { describe, expect, it } from "vitest";
import {
  ageLabel,
  agingShares,
  amountInput,
  bucketInfo,
  businessToday,
  checkAmount,
  defaultMethod,
  paidPercent,
  recordableMethods,
} from "./paymentDomain";

describe("payment amount rules (D-132)", () => {
  it("accepts up to the amount due and says what is left", () => {
    expect(checkAmount("10", "31.000")).toEqual({ amount: "10.000", help: "بيضل عليه 21.00 د.أ" });
    expect(checkAmount("31", "31.000")).toEqual({ amount: "31.000", help: "بيصير مدفوع بالكامل" });
    expect(checkAmount("١٢٫٥", "31.000").amount).toBe("12.500"); // Arabic digits and separator
  });

  it("rejects zero, more than due, more than 2 decimals and junk", () => {
    for (const input of ["0", "31.01", "1.005", "abc", ""]) {
      const check = checkAmount(input, "31.000");
      expect(check.amount).toBeNull();
      expect(check.error).toContain("31.00");
    }
  });

  it("prefills the amount due with 2 decimals and no separators", () => {
    expect(amountInput("1250.500")).toBe("1250.50");
    expect(checkAmount(amountInput("1250.500"), "1250.500").amount).toBe("1250.500");
  });
});

describe("recordable methods (D-138)", () => {
  const enabled = [
    { method: "cash", isEnabled: true },
    { method: "cod", isEnabled: true },
    { method: "cliq", isEnabled: false },
    { method: "bank_transfer", isEnabled: true },
  ] as const;

  it("keeps enabled methods and never offers COD", () => {
    expect(recordableMethods([...enabled])).toEqual(["cash", "bank_transfer"]);
    expect(recordableMethods(undefined)).toEqual([]);
  });

  it("defaults to the expected method when it can be recorded", () => {
    expect(defaultMethod(["cash", "bank_transfer"], "bank_transfer")).toBe("bank_transfer");
    expect(defaultMethod(["cash", "bank_transfer"], "cod")).toBe("cash");
    expect(defaultMethod([], null)).toBeNull();
  });
});

describe("figures for the screens", () => {
  it("pay ring percent is whole and bounded", () => {
    expect(paidPercent("31.000", "10.000")).toBe(32);
    expect(paidPercent("31.000", "31.000")).toBe(100);
    expect(paidPercent("0.000", "0.000")).toBe(100);
  });

  it("agebar shares follow the amounts and handle no receivables", () => {
    expect(agingShares(["17.000", "11.000", "0.000"]).map(Math.round)).toEqual([61, 39, 0]);
    expect(agingShares(["0.000", "0.000", "0.000"])).toEqual([0, 0, 0]);
  });

  it("buckets and ages read naturally (D-038)", () => {
    expect([bucketInfo("fresh").ageClass, bucketInfo("late").ageClass, bucketInfo("overdue").ageClass]).toEqual([
      "age--ok",
      "age--warn",
      "age--late",
    ]);
    expect([ageLabel(0), ageLabel(1), ageLabel(12)]).toEqual(["اليوم", "يوم", "12 يوم"]);
  });

  it("business today is the Amman calendar day (D-124)", () => {
    expect(businessToday(new Date("2026-11-20T22:30:00Z"))).toBe("2026-11-21");
    expect(businessToday(new Date("2026-11-20T20:59:00Z"))).toBe("2026-11-20");
  });
});
