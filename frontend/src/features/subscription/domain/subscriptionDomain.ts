import type { SubscriptionSummary } from "@/features/auth";

// Pure rules of the subscription UI (D-162, D-165, D-167, D-183): status words, banners, plans. Unit-tested.

export type SubscriptionStatus = SubscriptionSummary["status"];
export type PaidPlan = "monthly" | "yearly";

/** D-183: the Arabic status words. */
export const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trial: "تجربة مجانية",
  trial_grace: "فترة سماح",
  trial_ended: "انتهت التجربة",
  active: "مشترك",
  active_grace: "فترة سماح",
  expired: "انتهى الاشتراك",
  suspended: "موقوف",
};

export type StatusTone = "success" | "warning" | "danger" | "info" | "attention";

export const STATUS_TONE: Record<SubscriptionStatus, StatusTone> = {
  trial: "info",
  trial_grace: "warning",
  trial_ended: "danger",
  active: "success",
  active_grace: "warning",
  expired: "danger",
  suspended: "danger",
};

export const PLAN_LABEL: Record<PaidPlan | "trial", string> = { trial: "التجربة", monthly: "الخطة الشهرية", yearly: "الخطة السنوية" };

const dayMonth = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** «31 كانون الأول 2026» for a YYYY-MM-DD date. */
export const dateLabel = (day: string): string => dayMonth.format(new Date(`${day}T00:00:00Z`));

/** The full status line, e.g. «مشترك بالخطة السنوية لحد 31 تشرين الأول 2027». */
export function statusLine(s: SubscriptionSummary): string {
  switch (s.status) {
    case "trial":
      return s.paidUntil ? `تجربة مجانية، وبعدها مدفوع لحد ${dateLabel(s.paidUntil)}` : `تجربة مجانية، ضل ${daysText(s.daysLeft)}`;
    case "trial_grace":
      return `خلصت التجربة، وضل ${daysText(s.daysLeft)} سماح قبل ما يصير الحساب للقراءة فقط`;
    case "trial_ended":
      return "انتهت التجربة: حسابك للقراءة فقط لحد ما تشترك";
    case "active":
      return `مشترك ب${PLAN_LABEL[s.plan]} لحد ${s.endsOn ? dateLabel(s.endsOn) : "—"}`;
    case "active_grace":
      return `خلص اشتراكك، وضل ${daysText(s.daysLeft)} سماح قبل ما يصير الحساب للقراءة فقط`;
    case "expired":
      return "انتهى الاشتراك: حسابك للقراءة فقط لحد ما تجدّد";
    default:
      return "حسابك موقوف حاليًا. تواصل معنا عشان نرجّعه";
  }
}

/** What follows the status badge in a table row (the badge already names the status), e.g. «ضل 12 يوم». */
export function statusDetail(s: SubscriptionSummary): string {
  switch (s.status) {
    case "trial":
      return s.paidUntil ? `بعدها مدفوع لحد ${dateLabel(s.paidUntil)}` : `ضل ${daysText(s.daysLeft)}`;
    case "active":
      return s.endsOn ? `${PLAN_LABEL[s.plan]} لحد ${dateLabel(s.endsOn)}` : PLAN_LABEL[s.plan];
    case "trial_grace":
    case "active_grace":
      return `ضل ${daysText(s.daysLeft)} قبل القراءة فقط`;
    case "trial_ended":
    case "expired":
      return "للقراءة فقط";
    default:
      return "";
  }
}

/** «يوم واحد», «يومين», «3 أيام», «15 يوم» (Levantine counting). */
export function daysText(n: number): string {
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومين";
  if (n >= 3 && n <= 10) return `${n} أيام`;
  return `${n} يوم`;
}

export interface BannerView {
  tone: "late" | "ended";
  text: string;
  cta: string;
}

/**
 * The top banner (D-162, D-186): the last 7 days of the trial or plan (only when nothing is queued after it), the
 * grace days, and read-only. Nothing otherwise.
 */
export function bannerFor(s: SubscriptionSummary | null | undefined): BannerView | null {
  if (!s) return null;
  switch (s.status) {
    case "trial":
      return !s.paidUntil && s.daysLeft <= 7 ? { tone: "late", text: `ضل ${daysText(s.daysLeft)} من تجربتك المجانية`, cta: "اشترك" } : null;
    case "active":
      return s.paidUntil === s.endsOn && s.daysLeft <= 7 ? { tone: "late", text: `اشتراكك بيخلص بعد ${daysText(s.daysLeft)}`, cta: "جدّد" } : null;
    case "trial_grace":
    case "active_grace":
      return { tone: "late", text: `فترة سماح: ضل ${daysText(s.daysLeft)} قبل ما يصير حسابك للقراءة فقط`, cta: "اشترك الآن" };
    case "trial_ended":
    case "expired":
      return { tone: "ended", text: "حسابك صار للقراءة فقط. بياناتك محفوظة، والإضافة بترجع لما تشترك", cta: "اشترك الآن" };
    default:
      return { tone: "ended", text: "حسابك موقوف حاليًا. تواصل معنا عشان نرجّعه", cta: "التفاصيل" };
  }
}

export interface RingView {
  /** 0–100, how much of the current span is left. */
  percent: number;
  /** The big number in the ring. */
  value: number;
  caption: string;
  /** Day dots (only for the 30-day trial). */
  dots: { total: number; used: number } | null;
}

/** The ring on the subscription page: the trial's 30 days or the paid run. */
export function ringFor(s: SubscriptionSummary, trialLength = 30): RingView {
  if (s.status === "trial") {
    const used = Math.min(trialLength, Math.max(0, trialLength - s.daysLeft));
    return { percent: (s.daysLeft / trialLength) * 100, value: s.daysLeft, caption: "يوم باقي", dots: { total: trialLength, used } };
  }

  if (s.status === "active") {
    const span = s.plan === "yearly" ? 365 : 30;
    return { percent: Math.min(100, (s.daysLeft / span) * 100), value: s.daysLeft, caption: "يوم باقي", dots: null };
  }

  if (s.status === "trial_grace" || s.status === "active_grace") {
    return { percent: (s.daysLeft / 3) * 100, value: s.daysLeft, caption: "يوم سماح", dots: null };
  }

  return { percent: 0, value: 0, caption: "يوم باقي", dots: null };
}

/** The yearly saving against 12 months (D-010): two months. */
export const yearlySaving = (monthly: number, yearly: number): number => monthly * 12 - yearly;
