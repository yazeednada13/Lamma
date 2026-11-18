import type { ReactNode } from "react";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

const R = 58;
const C = 2 * Math.PI * R;

/** SVG donut ported from the design system's `LammaCards.donut` (same markup and classes). */
export function Donut({ segments, center, sub }: { segments: readonly DonutSegment[]; center: ReactNode; sub?: string }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const gap = segments.length > 1 ? 4 : 0;
  // Each arc starts where the previous ones end (computed up front; render stays pure).
  const arcs = segments.map((s, i) => {
    const before = segments.slice(0, i).reduce((sum, x) => sum + (x.value / total) * C, 0);
    return { ...s, length: (s.value / total) * C, offset: before };
  });
  return (
    <div className="donut">
      <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
        <circle r={R} cx="75" cy="75" stroke="#F1F3EA" />
        {arcs.map((s, i) => (
          <circle
            key={s.label}
            className="seg"
            r={R}
            cx="75"
            cy="75"
            stroke={s.color}
            strokeDasharray={`${Math.max(s.length - gap, 0.1)} ${C}`}
            strokeDashoffset={-s.offset}
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <title>{`${s.label}: ${Math.round((s.value / total) * 100)}%`}</title>
          </circle>
        ))}
      </svg>
      <div className="donut__c">
        <b>{center}</b>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}
