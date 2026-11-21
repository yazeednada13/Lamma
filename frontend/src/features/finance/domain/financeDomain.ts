import { formatMoneyNumber, fromFils, parseMoneyInput, toFils, type MoneyString } from "@/shared/lib/money";
import type { IconName } from "@/shared/ui/Icon";
import type { CategoryCode } from "../api/financeApi";

// Pure rules of the finance screens: periods (Asia/Amman, D-124), category look, settlement math (D-141), shares.

const ammanDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Amman",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Business today (Asia/Amman) as YYYY-MM-DD. */
export const businessToday = (now: Date = new Date()): string => ammanDay.format(now);

export type PeriodPreset = "month" | "last_month";

export const PERIOD_PRESETS: readonly { code: PeriodPreset; label: string }[] = [
  { code: "month", label: "هالشهر" },
  { code: "last_month", label: "الشهر الماضي" },
];

/** Inclusive business-local range of a preset: this month to date, or the whole previous month. */
export function periodRange(preset: PeriodPreset, now: Date = new Date()): { from: string; to: string } {
  const today = businessToday(now);
  const [y, m] = today.split("-").map(Number) as [number, number];
  if (preset === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  const first = new Date(Date.UTC(y, m - 2, 1));
  const last = new Date(Date.UTC(y, m - 1, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

const monthName = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { month: "long", timeZone: "UTC" });

/** «تشرين الثاني» for a YYYY-MM-DD date. */
export const monthLabel = (day: string): string => monthName.format(new Date(`${day}T00:00:00Z`));

const dayFormat = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { day: "numeric", month: "long", timeZone: "UTC" });

export const dayLabel = (day: string): string => dayFormat.format(new Date(`${day}T00:00:00Z`));

/** Icons of the default categories (prototype `ICON`); custom categories use the wallet. */
export const CATEGORY_ICON: Record<CategoryCode, IconName> = {
  ads: "brand-instagram",
  delivery: "truck",
  packaging: "gift",
  rent: "home",
  other: "dots-vertical",
};

export const categoryIcon = (code: CategoryCode | null): IconName => (code ? CATEGORY_ICON[code] : "wallet");

/** Chart colours in order (prototype `catColors`) and the matching chip tones. */
export const CHART_COLORS = [
  "var(--lamma-chart-1)",
  "var(--lamma-chart-2)",
  "var(--lamma-chart-3)",
  "var(--lamma-chart-4)",
  "var(--lamma-chart-5)",
] as const;
export const CHIP_TONES = ["tone-olive", "tone-apricot", "tone-blue", "tone-brick", "tone-green"] as const;

/** Whole-percent share of each amount in the total (0 when there is nothing). */
export function percentShares(amounts: readonly MoneyString[]): number[] {
  const fils = amounts.map(toFils);
  const total = fils.reduce((a, b) => a + b, 0);
  return fils.map((f) => (total > 0 ? Math.round((f / total) * 100) : 0));
}

/** Bar widths relative to the largest amount (prototype `.xcat .flowbar`). */
export function barWidths(amounts: readonly MoneyString[]): number[] {
  const fils = amounts.map(toFils);
  const max = Math.max(0, ...fils);
  return fils.map((f) => (max > 0 ? (f / max) * 100 : 0));
}

export interface SettlementPreview {
  expected: MoneyString;
  /** The parsed received amount, or null when it cannot be saved. */
  received: MoneyString | null;
  difference: MoneyString;
  error?: string;
}

/**
 * Live settlement math in integer fils (D-141): expected = Σ remaining of the picked orders; 0 ≤ received ≤ expected
 * (≤ 2 decimals); the difference becomes a «توصيل» expense.
 */
export function settlementPreview(remainings: readonly MoneyString[], receivedInput: string): SettlementPreview {
  const expected = remainings.reduce((sum, r) => sum + toFils(r), 0);
  const parsed = receivedInput.trim() === "" ? null : parseMoneyInput(receivedInput);
  if (remainings.length === 0) {
    return { expected: fromFils(0), received: null, difference: fromFils(0), error: "اختار طلب واحد على الأقل." };
  }

  if (parsed === null || toFils(parsed) > expected) {
    return {
      expected: fromFils(expected),
      received: null,
      difference: fromFils(0),
      error: `المبلغ لازم يكون بين 0 و ${formatMoneyNumber(fromFils(expected))} د.أ`,
    };
  }

  return { expected: fromFils(expected), received: parsed, difference: fromFils(expected - toFils(parsed)) };
}

/** Groups items by a YYYY-MM-DD key, newest day first, keeping the order inside a day. */
export function groupByDay<T>(items: readonly T[], dayOf: (item: T) => string): { day: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const day = dayOf(item);
    groups.set(day, [...(groups.get(day) ?? []), item]);
  }

  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([day, list]) => ({ day, items: list }));
}

/** «ملاحظة لمّة» of the expenses page (prototype): biggest category and, when known, the share of sales. */
export function expenseInsight(
  top: { name: string; amount: MoneyString } | undefined,
  total: MoneyString,
  sales?: MoneyString,
): string {
  if (!top || toFils(total) <= 0) return "لسا ما سجّلت مصاريف بهالفترة.";
  const share = Math.round((toFils(top.amount) / toFils(total)) * 100);
  const ofSales =
    sales && toFils(sales) > 0
      ? ` المصاريف بتاكل ${Math.round((toFils(total) / toFils(sales)) * 100)}% من مبيعاتك.`
      : "";
  return `أكبر مصروف «${top.name}» بنسبة ${share}% من المصاريف.${ofSales}`;
}
