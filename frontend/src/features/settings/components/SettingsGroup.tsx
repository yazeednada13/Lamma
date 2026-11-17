import type { ReactNode } from "react";
import { Icon, type IconName } from "@/shared/ui/Icon";

/** `.card.sgroup` settings section with tone chip header (prototype `sgroup`). */
export function SettingsGroup({ id, icon, tone, title, subtitle, children }: { id: string; icon: IconName; tone: string; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="card sgroup" id={id} aria-labelledby={`${id}-title`}>
      <div className="shead">
        <span className={`chipi ${tone}`}>
          <Icon name={icon} />
        </span>
        <div className="shead__t">
          <h2 id={`${id}-title`}>{title}</h2>
          {subtitle && <span className="caption">{subtitle}</span>}
        </div>
      </div>
      {children}
    </section>
  );
}
