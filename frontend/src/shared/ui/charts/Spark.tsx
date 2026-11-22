import { smoothPath } from "./chartMath";

/** Sparkline (prototype `LammaCards.spark`): right to left, min/max scaled, filled under the line. */
export function Spark({ values, w = 240, h = 54, pad = 6 }: { values: readonly number[]; w?: number; h?: number; pad?: number }) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i): [number, number] => {
    const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
    return [w - x, h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2)];
  });
  const d = smoothPath(pts);
  const length = Math.ceil(pts.reduce((s, p, i) => (i === 0 ? 0 : s + Math.hypot(p[0] - pts[i - 1]![0], p[1] - pts[i - 1]![1])), 0) * 1.2);
  const last = pts[pts.length - 1]!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="spark-area fade-up" d={`${d} L${last[0]} ${h} L${pts[0]![0]} ${h}Z`} />
      <path className="spark-line draw" style={{ ["--len" as string]: length }} d={d} />
    </svg>
  );
}
