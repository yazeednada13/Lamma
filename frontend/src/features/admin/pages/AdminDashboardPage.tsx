import { Link } from "react-router";
import { errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber } from "@/shared/lib/money";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useAdminDashboard } from "../api/adminApi";
import s from "../admin.module.css";

const shortDay = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { day: "numeric", month: "short", timeZone: "UTC" });

/** The admin home (D-164): what needs action first, then the numbers and the weekly sign-ups. */
export function AdminDashboardPage() {
  const query = useAdminDashboard();
  const header = <PageHeader title="لوحة الإدارة" subtitle="المشتركين والدفعات بنظرة وحدة" />;
  if (query.error) {
    return (
      <>
        {header}
        <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      </>
    );
  }

  const d = query.data;
  if (!d) {
    return (
      <>
        {header}
        <PageSkeleton />
      </>
    );
  }

  const cards: { label: string; value: string; icon: IconName; to?: string; hot?: boolean }[] = [
    { label: "دفعات بانتظار المراجعة", value: String(d.pendingPayments), icon: "credit-card", to: "/admin/payments", hot: d.pendingPayments > 0 },
    { label: "سجّلوا وما كمّلوا", value: String(d.pendingLeads), icon: "list", to: "/admin/leads?status=pending" },
    { label: "تجارب شغالة", value: String(d.activeTrials), icon: "gift", to: "/admin/subscribers?status=trial" },
    { label: "تجارب بتخلص خلال 7 أيام", value: String(d.trialsEndingSoon), icon: "clock", to: "/admin/subscribers?status=trial" },
    { label: "مشتركين دافعين", value: String(d.paying), icon: "users", to: "/admin/subscribers?status=active" },
    { label: "حسابات للقراءة فقط", value: String(d.readOnly), icon: "lock", to: "/admin/subscribers?status=read_only" },
    { label: "موقوفين", value: String(d.suspended), icon: "x", to: "/admin/subscribers?status=suspended" },
    { label: "الدخل الشهري (د.أ)", value: formatMoneyNumber(d.monthlyRevenue), icon: "cash" },
    { label: "نسبة التحويل لمدفوع", value: d.conversionRate === null ? "—" : `${d.conversionRate}%`, icon: "chart-bar" },
  ];
  const max = Math.max(1, ...d.weeks.flatMap((w) => [w.leads, w.accounts]));

  return (
    <>
      {header}
      <div className={s.kpis}>
        {cards.map((c) => {
          const body = (
            <>
              <span>
                <Icon name={c.icon} size={16} /> {c.label}
              </span>
              <b>{c.value}</b>
            </>
          );
          return c.to ? (
            <Link key={c.label} to={c.to} className={`${s.kpi} ${c.hot ? s.kpiHot : ""}`}>
              {body}
            </Link>
          ) : (
            <div key={c.label} className={s.kpi}>
              {body}
            </div>
          );
        })}
      </div>
      <article className="card">
        <div className="shead">
          <div className="shead__t">
            <span className="overline">آخر 8 أسابيع</span>
            <h2>التسجيلات</h2>
          </div>
          <span className="legend">
            <span>
              <i style={{ background: "#CDD3BC" }} />
              عبّوا النموذج
            </span>
            <span>
              <i style={{ background: "#3F4F2A" }} />
              فتحوا متجر
            </span>
          </span>
        </div>
        <div className={s.chart} role="img" aria-label={d.weeks.map((w) => `${w.weekStart}: ${w.leads} نموذج، ${w.accounts} متجر`).join("؛ ")}>
          {d.weeks.map((w) => (
            <div key={w.weekStart} className={s.week}>
              <div className={s.bars}>
                <i style={{ height: `${(w.leads / max) * 100}%` }} title={`${w.leads} نموذج`} />
                <i style={{ height: `${(w.accounts / max) * 100}%` }} title={`${w.accounts} متجر`} />
              </div>
              <small>{shortDay.format(new Date(`${w.weekStart}T00:00:00Z`))}</small>
            </div>
          ))}
        </div>
      </article>
    </>
  );
}
