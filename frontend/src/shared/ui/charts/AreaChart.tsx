import { useId, useState, type ReactNode } from "react";
import { areaGeometry, showLabel, smoothPath } from "./chartMath";

export interface AreaPoint {
  key: string;
  /** Axis label under the point. */
  label: string;
  /** First series (drawn filled), in any unit (e.g. fils). */
  a: number;
  /** Second series (line only). */
  b: number;
  /** Tooltip content on hover. */
  tip: ReactNode;
}

/**
 * Two-series area chart with hover tooltips (prototype `LammaCards.area`, same markup and classes). Right to left: the
 * newest point sits on the left. At most about 7 axis labels are shown, plus the last one.
 */
export function AreaChart({ points, ariaLabel }: { points: readonly AreaPoint[]; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const gradient = `area-g-${useId().replace(/:/g, "")}`;
  const w = 640;
  const h = 220;
  const g = areaGeometry(points, w, h);
  const step = (w - 28) / Math.max(points.length - 1, 1);
  const labelEvery = Math.ceil(points.length / 7);
  const tip = hover === null ? null : points[hover];
  if (points.length === 0) return null;
  return (
    <div className="area" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3F4F2A" stopOpacity=".22" />
            <stop offset="1" stopColor="#3F4F2A" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} className="grid-line" x1="0" x2={w} y1={g.y((g.max * f) / 1.15)} y2={g.y((g.max * f) / 1.15)} />
        ))}
        <path
          className="fade-up"
          d={`${smoothPath(g.a)} L${g.a[g.a.length - 1]![0]} ${h - 28} L${g.a[0]![0]} ${h - 28}Z`}
          fill={`url(#${gradient})`}
        />
        <path
          className="draw"
          d={smoothPath(g.a)}
          fill="none"
          stroke="var(--lamma-chart-1)"
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          className="draw"
          style={{ animationDelay: "350ms" }}
          d={smoothPath(g.b)}
          fill="none"
          stroke="var(--lamma-chart-2)"
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => (
          <g key={p.key}>
            <rect className="hit" x={g.x(i) - step / 2} y="0" width={step} height={h} onMouseEnter={() => setHover(i)} />
            <circle
              className={`dot${hover === i ? " is-on" : ""}`}
              cx={g.x(i)}
              cy={g.a[i]![1]}
              r="4.5"
              stroke="var(--lamma-chart-1)"
            />
            {showLabel(i, points.length, labelEvery) && (
              <text className="lbl" x={g.x(i)} y={h - 6} textAnchor="middle">
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
      {tip && hover !== null && (
        <div
          className="area__tip is-on"
          style={{ left: `${(g.x(hover) / w) * 100}%`, top: `${(g.a[hover]![1] / h) * 100}%` }}
        >
          {tip.tip}
        </div>
      )}
    </div>
  );
}
