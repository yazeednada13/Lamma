import type { BadgeTone } from "@/shared/ui/Badge";
import type { IconName } from "@/shared/ui/Icon";
import { fromFils, toFils, type MoneyString } from "@/shared/lib/money";
import type { CancelReason, OrderStatus } from "../api/ordersApi";

// Order statuses (D-020), the forward flow (D-121) and pure receipt math (D-031, D-125, D-126).

export interface StatusInfo {
  label: string;
  tone?: BadgeTone;
  icon: IconName;
}

export const STATUS: Record<OrderStatus, StatusInfo> = {
  new: { label: "جديد", tone: "info", icon: "receipt" },
  confirmed: { label: "مؤكد", icon: "check" },
  preparing: { label: "قيد التجهيز", tone: "warning", icon: "gift" },
  courier: { label: "مع المندوب", tone: "info", icon: "truck" },
  delivered: { label: "تم التوصيل", tone: "success", icon: "circle-check" },
  cancelled: { label: "ملغي", tone: "danger", icon: "x" },
  returned: { label: "مرتجع", icon: "arrow-back-up" },
};

/** All statuses in display order (the status rail). */
export const STATUSES: readonly OrderStatus[] = ["new", "confirmed", "preparing", "courier", "delivered", "cancelled", "returned"];

/** The lifecycle shown on the board, the track and the details stepper. */
export const FLOW: readonly OrderStatus[] = ["new", "confirmed", "preparing", "courier", "delivered"];

/** Position in the 5-step flow, or -1 for cancelled/returned. */
export const flowIndex = (status: OrderStatus): number => FLOW.indexOf(status);

/** Statuses that hold stock reserved for the order (D-024). */
export const isReserving = (status: OrderStatus): boolean => status === "confirmed" || status === "preparing" || status === "courier";

/** Toast after a status change (prototype `App.statusMsg`). */
export function statusMessage(number: number, to: OrderStatus): string {
  switch (to) {
    case "confirmed":
      return `الطلب #${number} صار «مؤكد» وانحجزت القطع تلقائيًا`;
    case "preparing":
      return `الطلب #${number} بيتغلّف هلّق`;
    case "courier":
      return `الطلب #${number} طلع مع المندوب`;
    case "delivered":
      return `تم توصيل #${number}: انخصمت القطع من المخزون وانحسبت المبيعة`;
    case "cancelled":
      return `انلغى الطلب #${number} ورجعت القطع المحجوزة للمتوفر`;
    default:
      return `الطلب #${number} صار «${STATUS[to].label}»`;
  }
}

/** Cancellation reasons (D-130). */
export const CANCEL_REASONS: readonly { code: CancelReason; label: string }[] = [
  { code: "changed_mind", label: "الزبون غيّر رأيه" },
  { code: "no_answer", label: "ما رد على التلفون" },
  { code: "unavailable", label: "المنتج مش متوفر" },
  { code: "other", label: "سبب ثاني" },
];

export const cancelReasonLabel = (code: CancelReason): string => CANCEL_REASONS.find((r) => r.code === code)?.label ?? code;

export const CANCEL_NOTE_MAX = 200;

/** «Other» needs a short text (D-130). Returns an error message or null. */
export function cancelProblem(reason: CancelReason, note: string): string | null {
  const text = note.trim();
  if (reason === "other" && !text) return "اكتب سبب الإلغاء.";
  if (text.length > CANCEL_NOTE_MAX) return `سبب الإلغاء لازم يكون ${CANCEL_NOTE_MAX} حرف أو أقل.`;
  return null;
}

export interface ReceiptLine {
  quantity: number;
  unitPrice: MoneyString;
  unitCost: MoneyString;
}

export interface Receipt {
  subtotal: MoneyString;
  total: MoneyString;
  itemsCost: MoneyString;
  /** "ربحك المتوقع" (D-125): items − discount − cost of items; the delivery fee is not profit. */
  profit: MoneyString;
  /** Discount above the items subtotal (D-126). */
  discountTooHigh: boolean;
}

/** Live receipt in integer fils (no floating point), the same formula as the server (D-031). */
export function computeReceipt(lines: readonly ReceiptLine[], deliveryFee: MoneyString, discount: MoneyString): Receipt {
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * toFils(l.unitPrice), 0);
  const cost = lines.reduce((sum, l) => sum + l.quantity * toFils(l.unitCost), 0);
  const fee = toFils(deliveryFee);
  const off = toFils(discount);
  return {
    subtotal: fromFils(subtotal),
    total: fromFils(subtotal + fee - off),
    itemsCost: fromFils(cost),
    profit: fromFils(subtotal - off - cost),
    discountTooHigh: off > subtotal,
  };
}

/** Quantity kept within 1…available (the stepper never goes above what can be reserved). */
export const clampQuantity = (quantity: number, available: number): number => Math.max(1, Math.min(quantity, Math.max(available, 1)));

/** "#1001" style search accepted as is; trims spaces. */
export const orderLabel = (number: number): string => `#${number}`;

/** Remaining whole seconds of an undo window (0 when expired). */
export function undoSecondsLeft(availableUntil: string, nowMs: number): number {
  return Math.max(0, Math.floor((Date.parse(availableUntil) - nowMs) / 1000));
}

export type DatePreset = "all" | "today" | "week" | "month";

export const DATE_PRESETS: readonly { code: DatePreset; label: string }[] = [
  { code: "all", label: "كل الفترات" },
  { code: "today", label: "اليوم" },
  { code: "week", label: "آخر 7 أيام" },
  { code: "month", label: "هالشهر" },
];

const ammanDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" });

/** The business-local calendar day (Asia/Amman, D-124) as YYYY-MM-DD. */
export const businessDate = (instant: Date): string => ammanDay.format(instant);

/** `from`/`to` query dates (business-local, inclusive) for a preset. */
export function presetRange(preset: DatePreset, now: Date): { from?: string; to?: string } {
  if (preset === "all") return {};
  const today = businessDate(now);
  if (preset === "today") return { from: today, to: today };
  if (preset === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const start = new Date(Date.UTC(y, m - 1, d - 6));
  return { from: start.toISOString().slice(0, 10), to: today };
}

/** Product art for a template code (unknown codes use the neutral art). */
export function productArt(templateCode: string): "clothing" | "perfume" | "gift" | "jewelry" | "beauty" | "other" {
  return (["clothing", "perfume", "gift", "jewelry", "beauty"] as const).find((a) => a === templateCode) ?? "other";
}
