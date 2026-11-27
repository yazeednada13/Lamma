// Pure rules of the admin area: labels for audit actions, relative times, phone display. Unit-tested.
import { dateLabel, daysText } from "@/features/subscription";

export const ACTION_LABEL: Record<string, string> = {
  extend_trial: "مدّد التجربة",
  activate_plan: "فعّل خطة",
  extend_plan: "مدّد الخطة",
  end_plan: "أنهى الخطة",
  suspend: "أوقف الحساب",
  reactivate: "رجّع الحساب",
  approve_payment: "وافق على دفعة",
  reject_payment: "رفض دفعة",
  resend_invite: "بعت رابط التسجيل من جديد",
  note: "ملاحظة",
};

export const actionLabel = (action: string): string => ACTION_LABEL[action] ?? action;

/** A short summary of an audit row's JSON details («10 أيام», «سنوية من … لحد …», the reason). */
export function auditSummary(action: string, details: string | null): string {
  if (!details) return "";
  if (action === "note") return details;
  try {
    const d = JSON.parse(details) as Record<string, unknown>;
    if (typeof d.days === "number") return daysText(d.days);
    if (typeof d.reason === "string") return d.reason;
    if (typeof d.plan === "string" && typeof d.startsOn === "string" && typeof d.endsOn === "string")
      return `${d.plan === "yearly" ? "سنوية" : "شهرية"} من ${dateLabel(d.startsOn)} لحد ${dateLabel(d.endsOn)}`;
    return "";
  } catch {
    return "";
  }
}

const rtf = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });

/** «قبل 3 أيام», «مبارح», «اليوم» … ; «ما دخل» when never. */
export function sinceLabel(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "ما دخل لسا";
  const diffMs = new Date(iso).getTime() - now.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (Math.abs(minutes) < 1) return "هلّق";
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

/** «مرة وحدة», «مرتين», «3 مرات», «11 مرة» (Levantine counting). */
export function timesText(n: number): string {
  if (n === 1) return "مرة وحدة";
  if (n === 2) return "مرتين";
  if (n >= 3 && n <= 10) return `${n} مرات`;
  return `${n} مرة`;
}

/** +962791234567 → 0791234567 (how Jordanians read it). */
export const localPhone = (e164: string | null): string => (e164?.startsWith("+962") ? `0${e164.slice(4)}` : (e164 ?? "—"));

/** WhatsApp link for a Jordanian mobile. */
export const whatsappLink = (e164: string | null): string | null => (e164 ? `https://wa.me/${e164.replace("+", "")}` : null);
