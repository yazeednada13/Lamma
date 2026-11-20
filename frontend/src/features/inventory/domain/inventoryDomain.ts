import { fromFils, parseMoneyInput, toFils, type MoneyString } from "@/shared/lib/money";
import type { AdjustmentReason } from "../api/inventoryApi";

// Inventory rules shown in the UI (D-110, D-111). The server stays authoritative.

export const REASONS: { code: AdjustmentReason; label: string; increase: boolean }[] = [
  { code: "damage", label: "تلف", increase: false },
  { code: "loss", label: "فقدان", increase: false },
  { code: "count", label: "جرد", increase: true },
  { code: "correction", label: "تصحيح", increase: true },
  { code: "gift", label: "هدية للزبون", increase: false },
];

/** Reasons allowed for a direction: every reason for a decrease, only count/correction for an increase. */
export function reasonsFor(increase: boolean) {
  return REASONS.filter((r) => !increase || r.increase);
}

export function reasonLabel(code: AdjustmentReason | null): string {
  return REASONS.find((r) => r.code === code)?.label ?? "";
}

/** On hand after the change and whether it would drop below the reserved pieces. */
export function adjustPreview(onHand: number, reserved: number, delta: number) {
  const after = onHand + delta;
  return { after, belowReserved: after < reserved };
}

/** Receipt totals in integer fils (no floating point): pieces and total cost; invalid costs count as 0. */
export function receiptTotals(lines: readonly { quantity: number; unitCost: string }[]): { pieces: number; total: MoneyString } {
  let fils = 0;
  let pieces = 0;
  for (const line of lines) {
    pieces += line.quantity;
    const cost = parseMoneyInput(line.unitCost);
    fils += cost === null ? 0 : toFils(cost) * line.quantity;
  }

  return { pieces, total: fromFils(fils) };
}

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Amman", year: "numeric", month: "2-digit", day: "2-digit" });
const dayLabel = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { timeZone: "Asia/Amman", day: "numeric", month: "long" });

/** Groups items by their local day in Asia/Amman, newest first as given; labels "اليوم" and "أمس". */
export function groupByDay<T extends { createdAt: string }>(items: readonly T[], now: Date = new Date()): { key: string; label: string; items: T[] }[] {
  const today = dayKey.format(now);
  const yesterday = dayKey.format(new Date(now.getTime() - 86_400_000));
  const groups: { key: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const date = new Date(item.createdAt);
    const key = dayKey.format(date);
    let group = groups.at(-1);
    if (group?.key !== key) {
      group = { key, label: key === today ? "اليوم" : key === yesterday ? "أمس" : dayLabel.format(date), items: [] };
      groups.push(group);
    }

    group.items.push(item);
  }

  return groups;
}

export const expiryLabel: Record<"expired" | "soon" | "ok", string> = { expired: "منتهي", soon: "قرب ينتهي", ok: "سليم" };
