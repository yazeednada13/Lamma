import { formatMoneyNumber, toFils, type MoneyString } from "@/shared/lib/money";
import { periodSearch, type PeriodCode, type PeriodSelection, type PnlLines, type PnlReport, type ReportPeriod } from "../api/reportsApi";

export { periodSearch, type PeriodSelection };

// Pure rules of the reports (D-168–D-172): period in the URL, wording, chart labels and the waterfall. Unit-tested.

export const PERIODS: readonly { code: PeriodCode; label: string }[] = [
  { code: "month", label: "هالشهر" },
  { code: "last_month", label: "الشهر الماضي" },
  { code: "last_7_days", label: "آخر 7 أيام" },
  { code: "custom", label: "فترة مخصصة" },
];

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CODES = new Set<string>(PERIODS.map((p) => p.code));

/** Reads `?period=&from=&to=` (D-168); anything unknown or incomplete falls back to this month. */
export function readPeriod(params: URLSearchParams): PeriodSelection {
  const period = params.get("period") ?? "month";
  if (!CODES.has(period)) return { period: "month" };
  if (period !== "custom") return { period: period as PeriodCode };
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  return DAY.test(from) && DAY.test(to) ? { period: "custom", from, to } : { period: "month" };
}

const ammanDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" });

/** Today in the business calendar, YYYY-MM-DD (D-124). */
export const businessToday = (now: Date = new Date()): string => ammanDay.format(now);

const at = (day: string) => new Date(`${day}T00:00:00Z`);
const monthOnly = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { month: "long", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { month: "short", year: "2-digit", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { day: "numeric", month: "long", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { day: "numeric", month: "short", timeZone: "UTC" });

export const monthName = (day: string): string => monthOnly.format(at(day));
export const dayLabel = (day: string): string => dayMonth.format(at(day));

/** «1 – 19 تشرين الثاني» or «20 تشرين الأول – 5 تشرين الثاني». */
export function rangeLabel(from: string, to: string): string {
  if (from === to) return dayLabel(from);
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8))} – ${dayLabel(to)}`;
  return `${dayLabel(from)} – ${dayLabel(to)}`;
}

/** What the page covers and what it is compared with (D-168). */
export function periodSubtitle(p: ReportPeriod): string {
  switch (p.period) {
    case "month":
      return `${monthName(p.from)} حتى اليوم، مقارنة بنفس الفترة من ${monthName(p.previousFrom)}`;
    case "last_month":
      return `${monthName(p.from)} كامل، مقارنة ب${monthName(p.previousFrom)}`;
    case "last_7_days":
      return `آخر 7 أيام، مقارنة بالـ7 أيام اللي قبلها`;
    default:
      return `${rangeLabel(p.from, p.to)}، مقارنة بنفس عدد الأيام اللي قبلها`;
  }
}

/** «مقارنة بنفس الفترة من تشرين الأول», «مقارنة بأيلول» or «مقارنة بـ9 آب – 30 أيلول» (D-168). */
export function compareLabel(p: ReportPeriod): string {
  if (p.period === "month") return `مقارنة بنفس الفترة من ${monthName(p.previousFrom)}`;
  if (p.period === "last_month") return `مقارنة ب${monthName(p.previousFrom)}`;
  return `مقارنة بـ${rangeLabel(p.previousFrom, p.previousTo)}`;
}

/** Axis label of a bucket: «اليوم», «20 تشرين الثاني» (short), or «تشرين الثاني 26» for month buckets. */
export function bucketLabel(start: string, p: ReportPeriod): string {
  if (p.bucket === "month") return monthYear.format(at(start));
  return p.includesToday && start === p.to ? "اليوم" : shortDay.format(at(start));
}

const abs = (m: MoneyString) => formatMoneyNumber(m).replace("−", "").replace("-", "");
const moved = (m: MoneyString) => (toFils(m) >= 0 ? "زادت" : "نقصت");

/**
 * «شو تغيّر؟» sentence (D-170, rules, no AI): the change in net profit and its largest driver.
 * e.g. «صافي الربح زاد 120.00 د.أ، وأكبر سبب إن المبيعات زادت 200.00 د.أ.»
 */
export function changeSentence(r: Pick<PnlReport, "hasPrevious" | "driver" | "netProfitChange">): string {
  if (!r.hasPrevious) return "ما في فترة سابقة للمقارنة.";
  const net = toFils(r.netProfitChange);
  if (!r.driver) return "صافي الربح ما تغيّر عن الفترة السابقة.";
  const d = r.driver;
  const what =
    d.kind === "sales" ? "المبيعات" : d.kind === "cogs" ? "تكلفة البضاعة" : `مصاريف «${d.categoryName ?? "أخرى"}»`;
  const reason = `${what} ${moved(d.change)} ${abs(d.change)} د.أ`;
  if (net === 0) return `صافي الربح ما تغيّر، بس ${reason}.`;
  return `صافي الربح ${net > 0 ? "زاد" : "نقص"} ${abs(r.netProfitChange)} د.أ، وأكبر سبب إن ${reason}.`;
}

// ---------- waterfall (prototype `waterfall`) ----------

export type WaterfallKind = "total" | "minus" | "sub" | "net";

export interface WaterfallStep {
  label: string;
  /** Fils; negative for what goes out. */
  value: number;
  kind: WaterfallKind;
}

/** Sales → returns → COGS → gross → each expense category → net. Zero «out» steps are dropped. */
export function waterfallSteps(lines: PnlLines, categories: readonly { name: string; current: MoneyString }[]): WaterfallStep[] {
  const steps: WaterfallStep[] = [
    { label: "المبيعات", value: toFils(lines.sales), kind: "total" },
    { label: "المرتجعات", value: -toFils(lines.returns), kind: "minus" },
    { label: "تكلفة البضاعة", value: -toFils(lines.cogs), kind: "minus" },
    { label: "إجمالي الربح", value: toFils(lines.grossProfit), kind: "sub" },
    ...categories
      .map((c) => ({ label: c.name, value: -toFils(c.current), kind: "minus" as const }))
      .sort((a, b) => a.value - b.value),
    { label: "صافي الربح", value: toFils(lines.netProfit), kind: "net" },
  ];
  return steps.filter((s) => s.kind !== "minus" || s.value !== 0);
}

export interface WaterfallBar extends WaterfallStep {
  cx: number;
  top: number;
  height: number;
  /** y of the running total after this bar, for the link to the next one. */
  level: number;
}

/**
 * Bars in a w × h box, right to left (RTL). Totals and the gross step stand on 0; each «out» step hangs from the running
 * total. The scale covers losses too (bars below the zero line).
 */
export function waterfallBars(steps: readonly WaterfallStep[], w: number, h: number, top = 24, bottom = 40) {
  let run = 0;
  const spans = steps.map((s) => {
    if (s.kind === "minus") {
      const from = run;
      run += s.value;
      return { lo: Math.min(from, run), hi: Math.max(from, run), level: run };
    }
    run = s.value;
    return { lo: Math.min(0, s.value), hi: Math.max(0, s.value), level: run };
  });
  const max = Math.max(1, ...spans.map((s) => s.hi));
  const min = Math.min(0, ...spans.map((s) => s.lo));
  const y = (v: number) => top + ((max - v) / (max - min)) * (h - top - bottom);
  const gap = w / Math.max(steps.length, 1);
  const bars: WaterfallBar[] = steps.map((s, i) => {
    const span = spans[i]!;
    const t = y(span.hi);
    return { ...s, cx: w - gap * (i + 0.5), top: t, height: Math.max(2, y(span.lo) - t), level: y(span.level) };
  });
  return { bars, zero: y(0), barWidth: Math.min(56, gap * 0.6), gap };
}

// ---------- sales ----------

/** Short weekday names, index 0 = Sunday (D-171). */
export const WEEKDAYS = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"] as const;

/** The week as it is read in Jordan: Saturday first. */
export const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;

/** Whole-number shares (%) of positive amounts; negatives count as 0. */
export function shares(values: readonly MoneyString[]): number[] {
  const fils = values.map((v) => Math.max(0, toFils(v)));
  const total = fils.reduce((s, v) => s + v, 0);
  return fils.map((v) => (total > 0 ? Math.round((v / total) * 100) : 0));
}
