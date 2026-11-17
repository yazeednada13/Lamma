import { describe, expect, it } from "vitest";
import { addMoney, formatMoneyNumber, fromFils, normalizeDigits, parseMoneyInput, toFils } from "./money";

describe("money", () => {
  it("converts between the 3-decimal wire format and integer fils", () => {
    expect(toFils("38.5")).toBe(38500);
    expect(toFils("38.500")).toBe(38500);
    expect(toFils("-2.005")).toBe(-2005);
    expect(fromFils(38500)).toBe("38.500");
    expect(fromFils(-2005)).toBe("-2.005");
    expect(() => toFils("1.2345")).toThrow();
  });


  it("adds without floating point drift", () => {
    expect(addMoney("0.100", "0.200")).toBe("0.300");
    expect(addMoney("38.000", "2.000", "-1.500")).toBe("38.500");
  });


  it("formats with Latin digits, 2 decimals and half-away-from-zero rounding (D-080)", () => {
    expect(formatMoneyNumber("38.000")).toBe("38.00");
    expect(formatMoneyNumber("38.505")).toBe("38.51");
    expect(formatMoneyNumber("38.504")).toBe("38.50");
    expect(formatMoneyNumber("-0.005")).toBe("−0.01");
    expect(formatMoneyNumber("1234567.000")).toBe("1,234,567.00");
    expect(formatMoneyNumber("1.234", 3)).toBe("1.234");
  });


  it("parses merchant input with Arabic digits and rejects more than 2 decimals", () => {
    expect(normalizeDigits("٣٨٫٥")).toBe("38.5");
    expect(parseMoneyInput("٣٨٫٥")).toBe("38.500");
    expect(parseMoneyInput("38")).toBe("38.000");
    expect(parseMoneyInput("38.123")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
    expect(parseMoneyInput("-5")).toBeNull();
  });
});
