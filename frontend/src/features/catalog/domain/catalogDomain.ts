import type { ProductArt } from "@/assets/illustrations/lammaArt";
import type { BadgeTone } from "@/shared/ui/Badge";
import type { StockStatusCode } from "../api/catalogTypes";

// Catalog presentation rules and pure helpers (D-090, D-093, D-099).

export const MAX_AXES = 2;
export const MAX_VALUES_PER_AXIS = 20;
export const MAX_VARIANTS = 100;
export const MAX_QUANTITY = 100_000;

export const stockStatusLabel: Record<StockStatusCode, string> = { in: "متوفر", low: "قرب يخلص", out: "نفد" };
export const stockStatusTone: Record<StockStatusCode, BadgeTone> = { in: "success", low: "attention", out: "danger" };

/** Template code → illustration (the six system templates share the art names). */
export function templateArt(code: string | undefined): ProductArt {
  return (["clothing", "perfume", "gift", "jewelry", "beauty"] as const).find((a) => a === code) ?? "other";
}

/** Colour swatches of the prototype's colour chips; other values render without a dot. */
export const COLOR_SWATCHES: Record<string, string> = {
  زيتي: "#3F4F2A",
  كريمي: "#EDE6D6",
  طوبي: "#C8553D",
  أسود: "#1F2617",
  سماوي: "#9DB4C0",
};

export interface Axis {
  name: string;
  values: string[];
}

/** Case-insensitive, trimmed key of a value combination (mirrors the server's OptionsKey). */
export function comboKey(values: readonly string[]): string {
  return values.map((v) => v.trim().toLowerCase()).join("|");
}

/** Axes that actually create variants: named, with at least one value. */
export function activeAxes(axes: readonly Axis[]): Axis[] {
  return axes.filter((a) => a.name.trim() && a.values.length > 0);
}

/** Every combination of the active axes' values, in axis order (rows of the first axis, then the second). */
export function combinations(axes: readonly Axis[]): string[][] {
  return activeAxes(axes).reduce<string[][]>((rows, axis) => rows.flatMap((row) => axis.values.map((v) => [...row, v])), [[]]).filter((r) => r.length > 0);
}

/** Adds or removes a value, keeping the suggested order first and custom values after. */
export function toggleValue(axis: Axis, value: string, suggested: readonly string[]): Axis {
  const exists = axis.values.some((v) => v.toLowerCase() === value.toLowerCase());
  if (exists) {
    return { ...axis, values: axis.values.filter((v) => v.toLowerCase() !== value.toLowerCase()) };
  }

  const next = [...axis.values, value];
  const rank = (v: string) => {
    const i = suggested.indexOf(v);
    return i < 0 ? suggested.length + next.indexOf(v) : i;
  };
  return { ...axis, values: next.sort((a, b) => rank(a) - rank(b)) };
}

export function parseQuantity(text: string): number {
  const n = Number.parseInt(text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_QUANTITY) : 0;
}
