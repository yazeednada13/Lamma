import type { IconName } from "@/shared/ui/Icon";

// Navigation model ported from the approved prototype (app.js NAV), with React Router paths.
// Modules not built yet open the shared "coming soon" page (D-085); see app/router/plannedRoutes.ts.

export interface NavItem {
  key: string;
  icon: IconName;
  label: string;
  to: string;
  subs?: readonly { label: string; to: string }[];
}

export const DAILY_NAV: readonly NavItem[] = [
  { key: "dashboard", icon: "home", label: "الرئيسية", to: "/" },
  {
    key: "orders",
    icon: "receipt",
    label: "الطلبات",
    to: "/orders",
    subs: [
      { label: "قائمة الطلبات", to: "/orders" },
      { label: "لوحة الحالات", to: "/orders/board" },
      { label: "الطلبات المسبقة", to: "/orders/preorders" },
    ],
  },
  {
    key: "products",
    icon: "package",
    label: "المنتجات",
    to: "/products",
    subs: [
      { label: "كل المنتجات", to: "/products" },
      { label: "التصنيفات", to: "/products/categories" },
    ],
  },
  {
    key: "inventory",
    icon: "building-warehouse",
    label: "المخزون",
    to: "/inventory",
    subs: [
      { label: "مستوى المخزون", to: "/inventory" },
      { label: "استلام بضاعة", to: "/inventory/receive" },
      { label: "سجل الحركات", to: "/inventory/movements" },
      { label: "تواريخ الانتهاء", to: "/inventory/expiry" },
    ],
  },
];

export const BUSINESS_NAV: readonly NavItem[] = [
  { key: "customers", icon: "users", label: "العملاء", to: "/customers" },
  {
    key: "finance",
    icon: "wallet",
    label: "المالية",
    to: "/finance",
    subs: [
      { label: "نظرة مالية", to: "/finance" },
      { label: "المدفوعات والذمم", to: "/finance/payments" },
      { label: "شركة التوصيل", to: "/finance/courier" },
      { label: "المصاريف", to: "/finance/expenses" },
    ],
  },
  {
    key: "reports",
    icon: "chart-bar",
    label: "التقارير",
    to: "/reports",
    subs: [
      { label: "مركز التقارير", to: "/reports" },
      { label: "الأرباح والخسائر", to: "/reports/pnl" },
      { label: "المبيعات", to: "/reports/sales" },
    ],
  },
];

export const SETTINGS_NAV: NavItem = { key: "settings", icon: "settings", label: "إعدادات المشروع", to: "/settings" };

/** Which sidebar section a pathname belongs to. */
export function sectionOf(pathname: string): string {
  const first = pathname.split("/").filter(Boolean)[0] ?? "";
  if (first === "") {
    return "dashboard";
  }

  if (first === "account" || first === "subscription") {
    return "settings";
  }

  return first;
}

/** Quick-add entries (topbar "جديد" menu and the mobile "+" hub), as in the prototype. */
export const QUICK_ADD: readonly { icon: IconName; label: string; to: string; tone: string }[] = [
  { icon: "receipt", label: "طلب", to: "/orders/new", tone: "tone-olive" },
  { icon: "package", label: "منتج", to: "/products/new", tone: "tone-apricot" },
  { icon: "users", label: "عميل", to: "/customers/new", tone: "tone-blue" },
  { icon: "cash", label: "دفعة", to: "/finance/payments?pay=1", tone: "tone-green" },
  { icon: "wallet", label: "مصروف", to: "/finance/expenses?add=1", tone: "tone-brick" },
  { icon: "truck", label: "استلام بضاعة", to: "/inventory/receive", tone: "tone-olive" },
];
