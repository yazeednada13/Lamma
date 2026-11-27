import { describe, expect, it } from "vitest";
import type { SubscriptionSummary } from "@/features/auth";
import { bannerFor, daysText, ringFor, statusDetail, statusLine, yearlySaving } from "./subscriptionDomain";

const s = (p: Partial<SubscriptionSummary>): SubscriptionSummary => ({
  status: "trial",
  readOnly: false,
  daysLeft: 20,
  endsOn: "2026-12-01",
  plan: "trial",
  paidUntil: null,
  ...p,
});

describe("subscription status words (D-183)", () => {
  it("counts days the Levantine way", () => {
    expect([1, 2, 3, 10, 11, 30].map(daysText)).toEqual(["يوم واحد", "يومين", "3 أيام", "10 أيام", "11 يوم", "30 يوم"]);
  });

  it("describes each status in one line", () => {
    expect(statusLine(s({ daysLeft: 12 }))).toBe("تجربة مجانية، ضل 12 يوم");
    expect(statusLine(s({ paidUntil: "2027-11-30" }))).toContain("مدفوع لحد");
    expect(statusLine(s({ status: "active", plan: "yearly", endsOn: "2027-10-31" }))).toBe("مشترك بالخطة السنوية لحد 31 تشرين الأول 2027");
    expect(statusLine(s({ status: "expired", readOnly: true }))).toContain("للقراءة فقط");
  });

  it("gives a short detail that does not repeat the badge", () => {
    expect(statusDetail(s({ daysLeft: 12 }))).toBe("ضل 12 يوم");
    expect(statusDetail(s({ status: "active", plan: "monthly", endsOn: "2026-12-26" }))).toBe("الخطة الشهرية لحد 26 كانون الأول 2026");
    expect(statusDetail(s({ status: "trial_grace", daysLeft: 2 }))).toBe("ضل يومين قبل القراءة فقط");
    expect(statusDetail(s({ status: "suspended", readOnly: true }))).toBe("");
  });
});

describe("banners (D-162, D-186)", () => {
  it("warns in the last 7 days, during grace, and when read-only", () => {
    expect(bannerFor(s({ daysLeft: 8 }))).toBeNull();
    expect(bannerFor(s({ daysLeft: 7 }))?.text).toBe("ضل 7 أيام من تجربتك المجانية");
    expect(bannerFor(s({ daysLeft: 3, paidUntil: "2027-01-01" }))).toBeNull(); // already paid for after the trial
    expect(bannerFor(s({ status: "trial_grace", daysLeft: 2 }))?.tone).toBe("late");
    expect(bannerFor(s({ status: "trial_ended", readOnly: true, daysLeft: 0 }))?.tone).toBe("ended");
    expect(bannerFor(s({ status: "active", daysLeft: 5, endsOn: "2027-01-05", paidUntil: "2027-02-05" }))).toBeNull(); // renewed
    expect(bannerFor(null)).toBeNull();
  });
});

describe("ring and plans", () => {
  it("shows the trial's days with dots, the paid run without", () => {
    expect(ringFor(s({ daysLeft: 10 }))).toEqual({ percent: (10 / 30) * 100, value: 10, caption: "يوم باقي", dots: { total: 30, used: 20 } });
    expect(ringFor(s({ status: "active", plan: "monthly", daysLeft: 15 })).dots).toBeNull();
    expect(ringFor(s({ status: "expired", daysLeft: 0 })).value).toBe(0);
  });

  it("yearly saves two months", () => expect(yearlySaving(9, 90)).toBe(18));
});
