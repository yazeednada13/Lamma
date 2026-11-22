import type { ReactNode } from "react";
import { Link } from "react-router";
import { QUICK_ADD } from "@/app/navigation/navigation";
import { LammaMark } from "@/shared/ui/brand/LammaMark";
import { Icon } from "@/shared/ui/Icon";
import { Menu } from "@/shared/ui/Menu";

/** Top bar: mobile mark, search placeholder (coming soon), the "new" menu, notifications placeholder, and an end slot. */
export function Topbar({ end }: { end?: ReactNode }) {
  return (
    <header className="topbar">
      <Link className="show-sm" to="/" aria-label="لمّة — الرئيسية">
        <LammaMark color="#3F4F2A" size={30} />
      </Link>
      <button
        type="button"
        className="qsearch hide-sm is-soon"
        aria-disabled="true"
        title="البحث قريبًا"
        aria-label="البحث (قريبًا)"
      >
        <span className="qsearch__ic">
          <Icon name="search" size={16} />
        </span>
        <span className="qsearch__hint">
          <span>
            دوّر على <b>طلب</b>، عميل، أو منتج · قريبًا
          </span>
        </span>
      </button>
      <div className="end row" style={{ gap: 6, position: "relative" }}>
        <button
          type="button"
          className="btn btn--ghost icon-btn show-sm is-soon"
          aria-disabled="true"
          aria-label="البحث (قريبًا)"
          title="البحث قريبًا"
        >
          <Icon name="search" />
        </button>
        <div className="hide-sm">
          <Menu
            label="إضافة جديد"
            style={{ insetInlineEnd: 0 }}
            trigger={(props) => (
              <button type="button" className="btn btn--primary" {...props}>
                <Icon name="plus" /> جديد
              </button>
            )}
          >
            {QUICK_ADD.map((entry, index) => (
              <div key={entry.to}>
                {index === 3 && <div className="menu__sep" />}
                <Link className="menu__item" role="menuitem" to={entry.to}>
                  <Icon name={entry.icon} /> {entry.label}
                </Link>
              </div>
            ))}
          </Menu>
        </div>
        <button
          type="button"
          className="btn btn--ghost icon-btn is-soon"
          aria-disabled="true"
          aria-label="الإشعارات (قريبًا)"
          title="الإشعارات قريبًا"
        >
          <Icon name="bell" />
        </button>
        {end}
      </div>
    </header>
  );
}
