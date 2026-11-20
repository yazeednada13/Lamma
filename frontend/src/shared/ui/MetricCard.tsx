import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { Icon, type IconName } from "./Icon";

/** Row metric card (design system `LammaCards.metric({ row: true })`). */
export function MetricCard({ icon, tone = "olive", label, value, unit, foot, to }: { icon: IconName; tone?: string; label: string; value: ReactNode; unit?: string; foot?: ReactNode; to?: string }) {
  const navigate = useNavigate();
  return (
    <article
      className={`card metric lift tone-${tone} metric--row`}
      onClick={to ? () => navigate(to) : undefined}
      style={to ? { cursor: "pointer" } : undefined}
      role={to ? "link" : undefined}
      tabIndex={to ? 0 : undefined}
      onKeyDown={to ? (e) => e.key === "Enter" && navigate(to) : undefined}
    >
      <span className="chipi">
        <Icon name={icon} />
      </span>
      <div style={{ minWidth: 0 }}>
        <span className="metric__label">{label}</span>
        <div className="metric__value">
          <bdi>{value}</bdi>
          {unit && <span className="metric__unit">{unit}</span>}
        </div>
        {foot && <div className="metric__foot">{foot}</div>}
      </div>
    </article>
  );
}
