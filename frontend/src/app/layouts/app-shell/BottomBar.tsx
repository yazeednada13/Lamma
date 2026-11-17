import { NavLink } from "react-router";
import { Icon } from "@/shared/ui/Icon";

const MORE_SECTIONS = ["inventory", "customers", "finance", "reports", "settings", "more"];

/** Mobile bottom navigation with the "+" button (shown below 768px by CSS). */
export function BottomBar({ section }: { section: string }) {
  return (
    <nav className="bottombar" aria-label="تنقّل الموبايل">
      <NavLink to="/" end className={section === "dashboard" ? "is-active" : undefined}>
        <Icon name="home" />
        الرئيسية
      </NavLink>
      <NavLink to="/orders" className={section === "orders" ? "is-active" : undefined}>
        <Icon name="receipt" />
        الطلبات
      </NavLink>
      <NavLink to="/new" aria-label="جديد">
        <span className="fab">
          <Icon name="plus" size={24} />
        </span>
      </NavLink>
      <NavLink to="/products" className={section === "products" ? "is-active" : undefined}>
        <Icon name="package" />
        المنتجات
      </NavLink>
      <NavLink to="/more" className={MORE_SECTIONS.includes(section) ? "is-active" : undefined}>
        <Icon name="dots-vertical" />
        المزيد
      </NavLink>
    </nav>
  );
}
