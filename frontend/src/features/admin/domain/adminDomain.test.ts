import { describe, expect, it } from "vitest";
import { actionLabel, auditSummary, localPhone, sinceLabel, timesText, whatsappLink } from "./adminDomain";

describe("admin wording", () => {
  it("names audit actions and summarises their details", () => {
    expect(actionLabel("extend_trial")).toBe("مدّد التجربة");
    expect(actionLabel("unknown")).toBe("unknown");
    expect(auditSummary("extend_trial", '{"days":10,"trialEndsAt":"x"}')).toBe("10 أيام");
    expect(auditSummary("suspend", '{"reason":"ما دفع"}')).toBe("ما دفع");
    expect(auditSummary("activate_plan", '{"plan":"yearly","startsOn":"2026-12-01","endsOn":"2027-11-30"}')).toBe("سنوية من 1 كانون الأول 2026 لحد 30 تشرين الثاني 2027");
    expect(auditSummary("note", "اتصلت فيها")).toBe("اتصلت فيها");
    expect(auditSummary("end_plan", "not json")).toBe("");
  });

  it("shows phones and last sign-in the local way", () => {
    expect(localPhone("+962791234567")).toBe("0791234567");
    expect(localPhone(null)).toBe("—");
    expect(whatsappLink("+962791234567")).toBe("https://wa.me/962791234567");
    expect(sinceLabel(null)).toBe("ما دخل لسا");
    expect(sinceLabel(new Date().toISOString())).toBe("هلّق");
    expect([1, 2, 3, 11].map(timesText)).toEqual(["مرة وحدة", "مرتين", "3 مرات", "11 مرة"]);
    const now = new Date("2026-11-22T12:00:00Z");
    expect(sinceLabel("2026-11-19T12:00:00Z", now)).toContain("3");
  });
});
