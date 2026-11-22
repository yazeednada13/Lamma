import { formatMoneyNumber, fromFils } from "@/shared/lib/money";
import { waterfallBars, type WaterfallStep } from "../domain/reportsDomain";

const W = 760;
const H = 280;

const color = (s: WaterfallStep) =>
  s.kind === "minus"
    ? "var(--lamma-brick-500)"
    : s.kind === "sub"
      ? "var(--lamma-olive-400)"
      : s.kind === "net"
        ? s.value >= 0
          ? "var(--lamma-apricot-500)"
          : "var(--lamma-red-500)"
        : "var(--lamma-olive-600)";

/** Profit waterfall (prototype `waterfall`): from sales to net, right to left, with dashed links between levels. */
export function Waterfall({ steps }: { steps: readonly WaterfallStep[] }) {
  const { bars, zero, barWidth, gap } = waterfallBars(steps, W, H);
  return (
    <div className="wf">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="شلال الربح">
        <line x1="0" x2={W} y1={zero} y2={zero} stroke="#E4E2D3" />
        {bars.map((b, i) => {
          const prev = bars[i - 1];
          const amount = formatMoneyNumber(fromFils(Math.abs(b.value))).split(".")[0];
          return (
            <g key={`${b.label}-${i}`}>
              {prev && (
                <line className="link" x1={b.cx + gap - barWidth / 2} x2={b.cx + barWidth / 2} y1={prev.level} y2={prev.level} />
              )}
              <rect
                className="bar"
                x={b.cx - barWidth / 2}
                y={b.top}
                width={barWidth}
                height={b.height}
                rx="6"
                fill={color(b)}
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <title>
                  {b.label}: {formatMoneyNumber(fromFils(b.value))} د.أ
                </title>
              </rect>
              <text className="val" x={b.cx} y={b.top - 6} textAnchor="middle">
                {b.value < 0 ? "−" : ""}
                {amount}
              </text>
              <text className="lbl" x={b.cx} y={H - 18} textAnchor="middle">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
