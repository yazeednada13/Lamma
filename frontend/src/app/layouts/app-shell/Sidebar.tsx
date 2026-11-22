import type { ReactNode } from "react";
import { Link } from "react-router";
import { LammaMark } from "@/shared/ui/brand/LammaMark";
import { Icon } from "@/shared/ui/Icon";
import { BUSINESS_NAV, DAILY_NAV, SETTINGS_NAV, type NavItem } from "@/app/navigation/navigation";
import { useSlidingPill } from "./useSlidingPill";

/** A counter or dot next to a sidebar item (prototype `.sb__badge`), keyed by the nav item key. */
export interface NavBadge {
  count?: number;
  hot?: boolean;
  dot?: boolean;
  label?: string;
}

function SidebarItem({
  item,
  section,
  pathname,
  index,
  badge,
}: {
  item: NavItem;
  section: string;
  pathname: string;
  index: number;
  badge?: NavBadge;
}) {
  const active = section === item.key;
  return (
    <>
      <Link
        className={`sb__item${active ? " is-active" : ""}${active && item.subs ? " is-open" : ""}`}
        to={item.to}
        data-tip={item.label}
        style={{ ["--i" as string]: index }}
        aria-current={active ? "page" : undefined}
      >
        <span className="sb__ic">
          <Icon name={item.icon} />
        </span>
        <span className="sb__label">{item.label}</span>
        {badge?.dot ? (
          <span className="sb__badge sb__badge--dot" aria-label={badge.label} />
        ) : badge?.count ? (
          <span className={`sb__badge${badge.hot ? " sb__badge--hot" : ""}`} aria-label={badge.label}>
            {badge.count}
          </span>
        ) : null}
        {item.subs && <Icon name="chevron-left" size={16} className="sb__chev" />}
      </Link>
      {item.subs && (
        <div className={`sb__sub${active ? " is-open" : ""}`} data-sub={item.key}>
          <div>
            <ul>
              {item.subs.map((sub) => (
                <li key={sub.to}>
                  <Link
                    to={sub.to}
                    className={pathname === sub.to ? "is-active" : undefined}
                    tabIndex={active ? undefined : -1}
                  >
                    {sub.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

interface SidebarProps {
  section: string;
  pathname: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Rendered under the brand row (e.g. the business card). */
  header?: ReactNode;
  /** Rendered at the bottom (e.g. trial card, user card). */
  footer?: ReactNode;
  /** Counters per nav key, filled by the app layer (D-158). */
  badges?: Readonly<Record<string, NavBadge>>;
}

/** The desktop/tablet sidebar: brand, navigation with the sliding pill, and header/footer slots. */
export function Sidebar({ section, pathname, collapsed, onToggleCollapse, header, footer, badges }: SidebarProps) {
  const { navRef, pillRef } = useSlidingPill(`${section}|${collapsed}`);
  return (
    <aside className="sb sb--static" aria-label="القائمة الرئيسية">
      <div className="sb__top">
        <Link className="sb__brand" to="/" aria-label="لمّة — الرئيسية">
          <LammaMark color="#F4A261" size={30} />
          <img src="/logo/lamma-wordmark-ar-reversed.svg" alt="" />
        </Link>
        <button
          type="button"
          className="sb__toggle"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "توسيع القائمة" : "تصغير القائمة"}
          aria-pressed={collapsed}
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>

      {header}

      <nav className="sb__nav" ref={navRef} aria-label="أقسام لمّة">
        <span className="sb__pill" ref={pillRef} />
        <div className="sb__group">اليومي</div>
        {DAILY_NAV.map((item, i) => (
          <SidebarItem
            key={item.key}
            item={item}
            section={section}
            pathname={pathname}
            index={i}
            badge={badges?.[item.key]}
          />
        ))}
        <div className="sb__group">إدارة المشروع</div>
        {BUSINESS_NAV.map((item, i) => (
          <SidebarItem
            key={item.key}
            item={item}
            section={section}
            pathname={pathname}
            index={DAILY_NAV.length + i}
            badge={badges?.[item.key]}
          />
        ))}
        <SidebarItem
          item={SETTINGS_NAV}
          section={section}
          pathname={pathname}
          index={DAILY_NAV.length + BUSINESS_NAV.length}
        />
      </nav>

      <div className="sb__foot">{footer}</div>
    </aside>
  );
}
