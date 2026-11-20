import { describe, expect, it } from "vitest";
import { GOVERNORATES, phoneDisplay, placeLabel, segmentTagClass, segmentTagLabel } from "./customerDomain";

describe("customer presentation", () => {
  it("shows Jordanian E.164 numbers the local way and keeps foreign ones", () => {
    expect(phoneDisplay("+962791234567")).toBe("079 123 4567");
    expect(phoneDisplay("+966501234567")).toBe("+966501234567");
    expect(phoneDisplay(null)).toBe("");
  });

  it("joins governorate and area like the prototype", () => {
    expect(placeLabel("amman", "خلدا")).toBe("عمّان · خلدا");
    expect(placeLabel("irbid", null)).toBe("إربد");
    expect(placeLabel(null, "الصويفية")).toBe("الصويفية");
    expect(placeLabel(null, null)).toBe("");
    expect(GOVERNORATES).toHaveLength(12);
  });

  it("labels segments with the design-system tag classes", () => {
    expect([segmentTagLabel("vip"), segmentTagClass("vip")]).toEqual(["مميز", "tag tag--vip"]);
    expect(segmentTagClass("owes")).toBe("tag tag--due");
    expect(segmentTagClass("dormant")).toBe("tag tag--sleep");
  });
});
