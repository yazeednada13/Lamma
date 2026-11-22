import { channelLabel } from "@/features/settings";
import { formatMoneyNumber, toFils, type MoneyString } from "@/shared/lib/money";
import type { IconName } from "@/shared/ui/Icon";
import type { ActivityItem, AttentionItem, Dashboard, Journey } from "../api/dashboardApi";

// Pure rules of «لمّة اليوم» (D-153–D-158): sentences, links and chart geometry. Unit-tested.

const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"] as const;

const ammanHour = (now: Date): number =>
  Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Amman" }).format(now));

/** "صباح الخير" before noon in Amman, "مساء الخير" after (D-124). */
export function greeting(now: Date = new Date()): string {
  return ammanHour(now) < 12 ? "صباح الخير" : "مساء الخير";
}

export type DayPhase = "morning" | "day" | "evening" | "night";

/** Sky of the delivery scene by the Amman hour: 05–10 morning, 11–16 day, 17–19 evening, otherwise night. */
export function dayPhase(now: Date = new Date()): DayPhase {
  const h = ammanHour(now);
  if (h >= 5 && h <= 10) return "morning";
  if (h >= 11 && h <= 16) return "day";
  if (h >= 17 && h <= 19) return "evening";
  return "night";
}

const fullDay = new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const monthOnly = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { month: "long", timeZone: "UTC" });
const shortDay = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { day: "numeric", month: "short", timeZone: "UTC" });
const at = (day: string) => new Date(`${day}T00:00:00Z`);

export const todayLabel = (day: string): string => fullDay.format(at(day));
export const monthName = (day: string): string => monthOnly.format(at(day));
export const prevMonthName = (monthStart: string): string =>
  monthOnly.format(new Date(at(monthStart).getTime() - 864e5));
export const chartDay = (day: string, today: string): string => (day === today ? "اليوم" : shortDay.format(at(day)));

/** The hero's lead sentence (prototype): open work and low stock in one line. */
export function leadSentence(j: Journey): string {
  const courier = j.courier ? `، و${j.courier} مع المندوب` : "";
  const stock = j.lowStock ? ` ${j.lowStock} منتجات قربت تخلص.` : " المخزون تمام.";
  return `عندك ${j.newOrders} طلبات جديدة و${j.preparing} بدها تجهيز${courier}.${stock}`;
}

export interface AttentionView {
  icon: IconName;
  title: string;
  subtitle: string;
  to: string;
}

const date = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { day: "numeric", month: "long", timeZone: "Asia/Amman" });

/** «يحتاج انتباهك» wording and link (prototype, D-157). */
export function attentionView(a: AttentionItem): AttentionView {
  switch (a.kind) {
    case "prepare":
      return {
        icon: "gift",
        title: `${a.count} طلبات بدها تجهيز`,
        subtitle: `أقدمها #${a.orderNumber} من ${a.since ? date.format(new Date(a.since)) : "—"}`,
        to: "/orders/board",
      };
    case "confirm":
      return {
        icon: "receipt",
        title: `${a.count} طلبات جديدة بانتظار تأكيدك`,
        subtitle: "أكّدها عشان تنحجز القطع",
        to: "/orders",
      };
    case "low_stock":
      return {
        icon: "package",
        title: `${a.name} ${a.available ? `· ضل ${a.available}` : "· نفد"}`,
        subtitle: `الحد ${a.threshold} قطع`,
        to: `/products/${a.refId}`,
      };
    case "courier":
      return {
        icon: "truck",
        title: `${formatMoneyNumber(a.amount ?? "0")} د.أ عند شركة التوصيل`,
        subtitle: `${a.count} طلبات بانتظار التحويل`,
        to: "/finance/courier",
      };
    case "due":
      return {
        icon: "cash",
        title: `${a.name} عليه ${formatMoneyNumber(a.amount ?? "0")} د.أ`,
        subtitle: "أكبر مبلغ مستحق",
        to: `/customers/${a.refId}`,
      };
  }
}

/** «ملاحظة لمّة» (prototype, D-157): rule-based, no AI. */
export function insightSentence(i: Dashboard["insight"]): string {
  if (!i.topChannel && i.bestWeekday === null) return "أول ما تتوصّل طلبات، بنقلك وين بتبيع أكثر وأي يوم أقوى.";
  const channel = i.topChannel
    ? `أكثر قناة بتبيع هالشهر «${channelLabel[i.topChannel]}»${i.topChannelShare !== null ? ` (${i.topChannelShare}%)` : ""}`
    : "";
  const day = i.bestWeekday !== null ? `أقوى يوم مبيعات عندك ${WEEKDAYS[i.bestWeekday]}` : "";
  const product = i.topProduct ? ` منتجك الأول: «${i.topProduct}».` : "";
  return `${[channel, day].filter(Boolean).join("، و")}.${product}`;
}

export interface ActivityView {
  tone: string;
  icon: IconName;
  title: string;
  subtitle: string;
}

const MOVE: Record<NonNullable<ActivityItem["type"]>, string> = {
  receive: "استلام بضاعة",
  adjustment: "تعديل مخزون",
  return: "مرتجع للمخزون",
};

export function activityView(a: ActivityItem): ActivityView {
  if (a.kind === "order")
    return {
      tone: "tone-blue",
      icon: "receipt",
      title: `طلب جديد #${a.number}`,
      subtitle: `${a.name} · ${formatMoneyNumber(a.amount ?? "0")} د.أ`,
    };
  if (a.kind === "expense")
    return {
      tone: "tone-brick",
      icon: "wallet",
      title: `مصروف ${a.name}`,
      subtitle: `${a.label ? `${a.label} · ` : ""}${formatMoneyNumber(a.amount ?? "0")} د.أ`,
    };
  const up = (a.quantity ?? 0) > 0;
  return {
    tone: up ? "tone-green" : "tone-apricot",
    icon: up ? "upload" : "package",
    title: `${a.type ? MOVE[a.type] : "حركة"} · ${a.name}`,
    subtitle: `${up ? "+" : ""}${a.quantity ?? 0}${a.label ? ` · ${a.label}` : ""}`,
  };
}

/** Money string → number of fils for the chart. */
export const filsOf = (m: MoneyString): number => toFils(m);
