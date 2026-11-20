// Modules planned for later phases. Each path renders the shared ComingSoonPage (D-085) until its phase ships;
// when a module is built, its route moves into the feature's routes.tsx and its entry is removed here.

/** Routes of modules planned for later phases (title, phase). */
export const COMING_SOON_ROUTES: readonly { path: string; title: string; phase: number }[] = [
  { path: "orders", title: "قائمة الطلبات", phase: 5 },
  { path: "orders/board", title: "لوحة الحالات", phase: 5 },
  { path: "orders/new", title: "طلب جديد", phase: 5 },
  { path: "orders/preorders", title: "الطلبات المسبقة", phase: 8 },
  { path: "finance", title: "نظرة مالية", phase: 7 },
  { path: "finance/payments", title: "المدفوعات والذمم", phase: 6 },
  { path: "finance/courier", title: "شركة التوصيل", phase: 7 },
  { path: "finance/expenses", title: "المصاريف", phase: 7 },
  { path: "reports", title: "مركز التقارير", phase: 10 },
  { path: "reports/pnl", title: "الأرباح والخسائر", phase: 10 },
  { path: "reports/sales", title: "المبيعات", phase: 10 },
  { path: "subscription", title: "الاشتراك", phase: 11 },
];
