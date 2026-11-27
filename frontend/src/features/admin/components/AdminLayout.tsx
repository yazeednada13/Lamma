import { NavLink, Outlet, useNavigate } from "react-router";
import { useCurrentAccount, useLogout } from "@/features/auth";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { useAdminDashboard } from "../api/adminApi";
import s from "../admin.module.css";

const TABS: { to: string; label: string; icon: IconName; count?: "payments" | "leads"; end?: boolean }[] = [
  { to: "/admin", label: "الرئيسية", icon: "home", end: true },
  { to: "/admin/subscribers", label: "المشتركين", icon: "users" },
  { to: "/admin/payments", label: "الدفعات", icon: "credit-card", count: "payments" },
  { to: "/admin/leads", label: "المسجّلين", icon: "list", count: "leads" },
];

/** The admin frame (D-175): its own top bar, separate from the store's app shell. */
export function AdminLayout() {
  const account = useCurrentAccount();
  const logout = useLogout();
  const navigate = useNavigate();
  const counts = useAdminDashboard().data;

  return (
    <div className={s.shell}>
      <header className={s.bar}>
        <div className={s.barIn}>
          <NavLink to="/admin" className={s.brand} aria-label="إدارة لمّة">
            <img src="/logo/lamma-lockup-ar-horizontal-reversed.svg" alt="لمّة" />
            <small>الإدارة</small>
          </NavLink>
          <nav className={s.tabs} aria-label="أقسام الإدارة">
            {TABS.map((t) => {
              const n = t.count === "payments" ? counts?.pendingPayments : t.count === "leads" ? counts?.pendingLeads : undefined;
              return (
                <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `${s.tab} ${isActive ? s.tabOn : ""}`}>
                  <Icon name={t.icon} size={16} /> {t.label}
                  {n ? <span className={s.count}>{n}</span> : null}
                </NavLink>
              );
            })}
          </nav>
          <div className={s.end}>
            <span>{account.fullName}</span>
            <button
              type="button"
              className={s.logout}
              onClick={() => logout.mutate(undefined, { onSettled: () => navigate("/login", { replace: true }) })}
            >
              <Icon name="logout" size={16} /> خروج
            </button>
          </div>
        </div>
      </header>
      <main className={s.main}>
        <Outlet />
      </main>
    </div>
  );
}
