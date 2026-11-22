// Pure chart math shared by the dashboard and the reports (prototype `LammaCards.delta` and `LammaCards.area`). Unit-tested.

export interface DeltaView {
  text: string;
  tone: "up" | "down" | "flat";
}

/** Delta pill (prototype `LammaCards.delta`): honest, "—" when nothing to compare (D-153). */
export function delta(change: number | null, invert = false): DeltaView {
  if (change === null || !Number.isFinite(change)) return { text: "—", tone: "flat" };
  const good = invert ? change <= 0 : change >= 0;
  return { text: `${change >= 0 ? "↑" : "↓"} ${Math.abs(change)}%`, tone: good ? "up" : "down" };
}

/** Smooth path through points (the prototype's monotone-ish cubic). */
export function smoothPath(points: readonly (readonly [number, number])[]): string {
  return points
    .map((p, i) => {
      if (i === 0) return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
      const a = points[i - 1]!;
      const cx = (a[0] + p[0]) / 2;
      return `C${cx.toFixed(1)} ${a[1].toFixed(1)} ${cx.toFixed(1)} ${p[1].toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    })
    .join(" ");
}

export interface AreaGeometry {
  max: number;
  x: (i: number) => number;
  y: (v: number) => number;
  a: [number, number][];
  b: [number, number][];
}

/**
 * Two-series area geometry in a w × h box, right to left (RTL: the newest day sits at the reading end, on the left).
 * Values are fils; the top leaves 15% headroom. Negative profit days are clipped at 0 (the baseline).
 */
export function areaGeometry(
  series: readonly { a: number; b: number }[],
  w: number,
  h: number,
  rtl = true,
): AreaGeometry {
  const padX = 14;
  const padT = 14;
  const padB = 28;
  const max = Math.max(1, ...series.map((s) => Math.max(s.a, s.b))) * 1.15;
  const x = (i: number) => {
    const v = padX + (i / Math.max(series.length - 1, 1)) * (w - padX * 2);
    return rtl ? w - v : v;
  };
  const y = (v: number) => padT + (1 - Math.max(0, v) / max) * (h - padT - padB);
  return { max, x, y, a: series.map((s, i) => [x(i), y(s.a)]), b: series.map((s, i) => [x(i), y(s.b)]) };
}

/** Every `every`-th label plus the last one, skipping a regular label that would sit too close to the last. */
export const showLabel = (i: number, count: number, every: number): boolean =>
  every <= 1 || i === count - 1 || (i % every === 0 && count - 1 - i >= Math.max(2, Math.ceil(every / 2)));
