import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/shared/ui/Icon";

export interface SettingsSection {
  id: string;
  icon: IconName;
  label: string;
}

/**
 * A settings section owned by another feature (e.g. catalog templates). It is composed in by the app layer,
 * so settings never imports that feature (FRONTEND-ARCHITECTURE §4, no cycles).
 */
export interface SettingsExtraSection extends SettingsSection {
  element: ReactNode;
}

/** Sticky jump links to the settings sections (prototype `.snav`). */
export function SettingsSectionNav({ sections }: { sections: readonly SettingsSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  return (
    <nav className="snav" aria-label="أقسام الإعدادات">
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          className={active === s.id ? "is-active" : undefined}
          onClick={(event) => {
            event.preventDefault();
            setActive(s.id);
            document.getElementById(s.id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          }}
        >
          <Icon name={s.icon} size={16} /> {s.label}
        </a>
      ))}
    </nav>
  );
}
