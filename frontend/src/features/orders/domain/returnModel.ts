import { fromFils, toFils, type MoneyString } from "@/shared/lib/money";
import type { OrderDetails, PreOrder } from "../api/ordersApi";

// Pure return math mirroring the server (D-148) and pre-order calendar helpers (D-151).

/** Pieces of an item that can still be returned. */
export const returnable = (item: { quantity: number; returnedQuantity: number }): number =>
  Math.max(0, item.quantity - item.returnedQuantity);

export interface ReturnPreview {
  /** This return's value: pieces × unit price − their discount share. */
  value: MoneyString;
  netAfter: MoneyString;
  /** Refund bounds that leave no customer credit (D-132). */
  minRefund: MoneyString;
  maxRefund: MoneyString;
}

type ReturnOrder = Pick<OrderDetails, "items" | "itemsSubtotal" | "discount" | "total" | "returnedAmount" | "paid">;

/**
 * Same formula as the server, in integer fils: the discount share is computed on the cumulative returned value and
 * rounded to 2 decimals (10 fils), so a full return removes exactly the discount.
 */
export function returnPreview(order: ReturnOrder, picks: Readonly<Record<string, number>>): ReturnPreview {
  const cumulative = order.items.reduce(
    (sum, i) => sum + (i.returnedQuantity + (picks[i.id] ?? 0)) * toFils(i.unitPrice),
    0,
  );
  const subtotal = toFils(order.itemsSubtotal);
  const share = subtotal === 0 ? 0 : Math.round((toFils(order.discount) * cumulative) / subtotal / 10) * 10;
  const returnedAfter = cumulative - share;
  const value = returnedAfter - toFils(order.returnedAmount);
  const netAfter = toFils(order.total) - returnedAfter;
  const paid = toFils(order.paid);
  return {
    value: fromFils(value),
    netAfter: fromFils(netAfter),
    minRefund: fromFils(Math.max(0, paid - netAfter)),
    maxRefund: fromFils(Math.max(0, Math.min(paid, value))),
  };
}

/** Week starts on Saturday, as in the prototype calendar (سبت … جمعة). */
export const WEEK_DAYS = ["سبت", "أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة"] as const;

const addDays = (day: string, n: number): string => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Calendar cells from `from` for `count` days, with leading blanks (null) so each date sits under its weekday. */
export function calendarCells(from: string, count: number): (string | null)[] {
  const [y, m, d] = from.split("-").map(Number) as [number, number, number];
  const offset = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 1) % 7; // Saturday → 0
  return [...Array<null>(offset).fill(null), ...Array.from({ length: count }, (_, i) => addDays(from, i))];
}

export const lastDay = (from: string, count: number): string => addDays(from, count - 1);

/** Pre-orders grouped by their expected date. */
export function byDay(orders: readonly PreOrder[]): Map<string, PreOrder[]> {
  const map = new Map<string, PreOrder[]>();
  for (const o of orders) map.set(o.expectedDeliveryOn, [...(map.get(o.expectedDeliveryOn) ?? []), o]);
  return map;
}

/** 30% of the total, rounded down to 2 decimals (the deposit shortcut, D-152). */
export const depositShortcut = (total: MoneyString): MoneyString =>
  fromFils(Math.floor((toFils(total) * 0.3) / 10) * 10);
