import type { ReactNode } from "react";
import { Link } from "react-router";
import { errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber, toFils } from "@/shared/lib/money";
import { initials } from "@/shared/lib/personName";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { Spark } from "@/shared/ui/charts/Spark";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useReportsSummary } from "../api/reportsApi";
import { monthName } from "../domain/reportsDomain";

const money = (m: string) => (
  <>
    <bdi>{formatMoneyNumber(m)}</bdi> <small>د.أ</small>
  </>
);

/** Reports hub (prototype `#/reports`, D-172): six cards with a preview each, this month. */
export function ReportsHubPage() {
  const summary = useReportsSummary();
  const month = summary.data ? monthName(summary.data.from) : "";
  const header = <PageHeader title="التقارير" subtitle={`افهم شغلك بالأرقام${month ? ` · ${month}` : ""}`} />;

  if (summary.error) {
    return (
      <>
        {header}
        <ErrorState message={errorMessage(summary.error)} onRetry={() => void summary.refetch()} />
      </>
    );
  }

  const s = summary.data;
  if (!s) {
    return (
      <>
        {header}
        <PageSkeleton />
      </>
    );
  }

  const top = s.topProducts[0];
  const topMax = Math.max(1, ...s.topProducts.map((p) => toFils(p.revenue)));
  const cards: { icon: IconName; title: string; to: string; big: ReactNode; preview: ReactNode }[] = [
    {
      icon: "wallet",
      title: "الأرباح والخسائر",
      to: "/reports/pnl",
      big: money(s.netProfit),
      preview: <Spark values={s.series.map((d) => toFils(d.grossProfit))} />,
    },
    {
      icon: "chart-bar",
      title: "المبيعات",
      to: "/reports/sales",
      big: money(s.netSales),
      preview: <Spark values={s.series.map((d) => toFils(d.sales))} />,
    },
    {
      icon: "package",
      title: "أداء المنتجات",
      to: "/reports/sales",
      big: top ? top.name : "—",
      preview: (
        <div className="row" style={{ gap: 4, height: "100%", alignItems: "flex-end", width: "100%" }}>
          {s.topProducts.map((p, i) => (
            <i
              key={p.productId}
              style={{
                flex: 1,
                height: `${Math.max(6, (Math.max(0, toFils(p.revenue)) / topMax) * 100)}%`,
                background: `var(--lamma-chart-${i ? 1 : 2})`,
                borderRadius: 4,
              }}
            />
          ))}
        </div>
      ),
    },
    {
      icon: "users",
      title: "العملاء",
      to: "/customers",
      big: `${s.customers} عميل`,
      preview: (
        <div className="row" style={{ gap: 6 }}>
          {s.recentCustomers.map((c) => (
            <span key={c.id} className="avatar">
              {initials(c.name)}
            </span>
          ))}
        </div>
      ),
    },
    {
      icon: "building-warehouse",
      title: "قيمة المخزون",
      to: "/inventory",
      big: money(s.stockValue),
      preview: <Illustration kind="parcel" />,
    },
    {
      icon: "truck",
      title: "التوصيل",
      to: "/finance/courier",
      big: money(s.courierHeld),
      preview: <Illustration kind="delivery" state="courier" />,
    },
  ];

  return (
    <>
      {header}
      <div className="grid g-3 stagger">
        {cards.map((c, i) => (
          <Link key={c.title} className="rcard" to={c.to} style={{ ["--i" as string]: i }}>
            <div className={`rcard__prev tone-${i % 2 ? "apricot" : "olive"}`}>{c.preview}</div>
            <div className="row">
              <span className="chipi tone-olive">
                <Icon name={c.icon} />
              </span>
              <div className="grow">
                <h3>{c.title}</h3>
                <b className="big">{c.big}</b>
              </div>
              <Icon name="arrow-left" size={16} />
            </div>
          </Link>
        ))}
      </div>
      <p className="caption" style={{ marginTop: 12 }}>
        قيمة المخزون محسوبة على القطع المتاحة بتكلفتها الحالية.
      </p>
    </>
  );
}
