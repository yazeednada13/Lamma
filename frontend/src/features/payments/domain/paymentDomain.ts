import { PAYMENT_METHODS, type PaymentMethodCode } from "@/features/settings";
import { formatMoneyNumber, fromFils, parseMoneyInput, toFils, type MoneyString } from "@/shared/lib/money";
import type { BadgeTone } from "@/shared/ui/Badge";
import type { AgingBucket, PaymentStatus } from "../api/paymentsApi";

// Payment statuses (D-021, D-133), aging buckets (D-038) and the pure amount rules of the payment drawer (D-132).

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: BadgeTone; outline?: boolean }> = {
  paid: { label: "مدفوع", tone: "success" },
  partial: { label: "جزئي", tone: "warning" },
  unpaid: { label: "غير مدفوع", tone: "danger", outline: true },
  courier: { label: "عند الشركة", tone: "info" },
};

export const AGING_BUCKETS: readonly { code: AgingBucket; label: string; color: string; ageClass: string }[] = [
  { code: "fresh", label: "أقل من أسبوع", color: "var(--lamma-green-500)", ageClass: "age--ok" },
  { code: "late", label: "8–30 يوم", color: "var(--lamma-apricot-500)", ageClass: "age--warn" },
  { code: "overdue", label: "أكثر من 30 يوم", color: "var(--lamma-brick-500)", ageClass: "age--late" },
];

export const bucketInfo = (code: AgingBucket) => AGING_BUCKETS.find((b) => b.code === code)!;

export const ageLabel = (days: number): string => (days === 0 ? "اليوم" : days === 1 ? "يوم" : `${days} يوم`);

/** Methods a merchant records by hand: enabled ones, never COD (the courier collects it, D-138). */
export function recordableMethods(
  enabled: readonly { method: PaymentMethodCode; isEnabled: boolean }[] | undefined,
): PaymentMethodCode[] {
  return PAYMENT_METHODS.filter((m) => m !== "cod" && (enabled?.some((r) => r.method === m && r.isEnabled) ?? false));
}

/** The drawer's default method: the order's expected one when it can be recorded, else the first recordable one. */
export function defaultMethod(
  methods: readonly PaymentMethodCode[],
  expected: PaymentMethodCode | null | undefined,
): PaymentMethodCode | null {
  return expected && methods.includes(expected) ? expected : (methods[0] ?? null);
}

/** "21.000" → "21.00": the prefilled amount (2 decimals, D-080, no thousands separators so it parses back). */
export const amountInput = (amount: MoneyString): string => formatMoneyNumber(amount).replace(/,/g, "");

export interface AmountCheck {
  /** The parsed amount (API format), or null when it cannot be saved. */
  amount: MoneyString | null;
  error?: string;
  help: string;
}

/**
 * Live check of the amount against the maximum due (D-132), in integer fils: > 0, ≤ 2 decimals, ≤ max.
 * `max` is the order's remaining or the customer's balance.
 */
export function checkAmount(input: string, max: MoneyString): AmountCheck {
  const parsed = parseMoneyInput(input);
  const maxFils = toFils(max);
  if (parsed === null || toFils(parsed) <= 0 || toFils(parsed) > maxFils) {
    return { amount: null, error: `المبلغ لازم يكون أكبر من صفر ولحد ${formatMoneyNumber(max)} د.أ`, help: "" };
  }

  const left = maxFils - toFils(parsed);
  return {
    amount: parsed,
    help: left > 0 ? `بيضل عليه ${formatMoneyNumber(fromFils(left))} د.أ` : "بيصير مدفوع بالكامل",
  };
}

/** Percent paid for the pay ring (0–100, whole number). */
export function paidPercent(total: MoneyString, paid: MoneyString): number {
  const t = toFils(total);
  return t <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((toFils(paid) / t) * 100)));
}

/** Width share (%) of each aging bucket in the agebar; empty buckets get 0. */
export function agingShares(amounts: readonly MoneyString[]): number[] {
  const fils = amounts.map(toFils);
  const total = fils.reduce((a, b) => a + b, 0);
  return fils.map((f) => (total > 0 ? (f / total) * 100 : 0));
}

const ammanDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Amman",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Business today (Asia/Amman, D-124) as YYYY-MM-DD: the default and the latest allowed payment date (D-136). */
export const businessToday = (now: Date = new Date()): string => ammanDay.format(now);
