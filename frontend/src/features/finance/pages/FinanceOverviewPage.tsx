import { useState } from "react";
import { Link } from "react-router";
import { errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber, toFils } from "@/shared/lib/money";
import { ButtonLink } from "@/shared/ui/Button";
import { Donut } from "@/shared/ui/charts/Donut";
import { Chip } from "@/shared/ui/Chip";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { MetricCard } from "@/shared/ui/MetricCard";
import { Money } from "@/shared/ui/Money";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useFinanceOverview } from "../api/financeApi";
import {
  CHART_COLORS,
  monthLabel,
  percentShares,
  PERIOD_PRESETS,
  periodRange,
  type PeriodPreset,
} from "../domain/financeDomain";

const LINKS: { icon: IconName; title: string; to: string; tone: string }[] = [
  { icon: "cash", title: "المدفوعات والذمم", to: "/finance/payments", tone: "tone-apricot" },
  { icon: "truck", title: "شركة التوصيل", to: "/finance/courier", tone: "tone-blue" },
  { icon: "chart-bar", title: "الأرباح والخسائر", to: "/reports/pnl", tone: "tone-green" },
];

/** Finance overview (prototype `#/finance`, D-144): net hero with the steps, metrics, where the money is, expenses by type. */
export function FinanceOverviewPage() {
  const [preset, setPreset] = useState<PeriodPreset>("month");
  const range = periodRange(preset);
  const overview = useFinanceOverview(range);
  const month = monthLabel(range.from);

  const header = (
    <PageHeader
      title="نظرة مالية"
      subtitle={`${month}${preset === "month" ? " حتى اليوم" : ""} · المبيعة بتنحسب عند التوصيل`}
      actions={
        <>
          <ButtonLink to="/finance/payments?pay=1" variant="outline" icon="cash">
            دفعة
          </ButtonLink>
          <ButtonLink to="/finance/expenses?add=1" icon="plus">
            مصروف
          </ButtonLink>
        </>
      }
    />
  );

  if (overview.error) {
    return (
      <>
        {header}
        <ErrorState message={errorMessage(overview.error)} onRetry={() => void overview.refetch()} />
      </>
    );
  }

  const m = overview.data;
  if (!m) {
    return (
      <>
        {header}
        <PageSkeleton />
      </>
    );
  }

  const net = toFils(m.netProfit);
  const cash = [
    { label: "استلمت فعليًا", value: m.cashReceived, color: "var(--lamma-green-500)", to: "/finance" },
    { label: "عند الزباين", value: m.customerDues, color: "var(--lamma-apricot-500)", to: "/finance/payments" },
    { label: "عند شركة التوصيل", value: m.courierHeld, color: "var(--lamma-blue-500)", to: "/finance/courier" },
  ];
  const cashShares = percentShares(cash.map((c) => c.value));
  const cats = m.expensesByCategory.map((c, i) => ({ ...c, color: CHART_COLORS[i % CHART_COLORS.length]! }));
  const catShares = percentShares(cats.map((c) => c.amount));
  const foot: Record<string, string> = {
    "/finance/payments": `عليهم ${formatMoneyNumber(m.customerDues)} د.أ`,
    "/finance/courier": `${formatMoneyNumber(m.courierHeld)} د.أ بانتظار التحويل`,
    "/reports/pnl": "التقرير الكامل مع شلال الربح",
  };

  return (
    <>
      {header}
      <div className="row wrap" style={{ gap: 6, marginBottom: 12 }} role="group" aria-label="الفترة">
        {PERIOD_PRESETS.map((p) => (
          <Chip key={p.code} selected={preset === p.code} onClick={() => setPreset(p.code)}>
            {p.code === "month" && <Icon name="calendar" size={16} />} {p.label}
          </Chip>
        ))}
      </div>
      <section className="lhero">
        <div>
          <span className="overline">
            صافي {net >= 0 ? "الربح" : "الخسارة"} · {month}
          </span>
          <div className="lhero__net">
            <bdi>{formatMoneyNumber(m.netProfit)}</bdi> <small>د.أ</small>
          </div>
          <p>
            {net >= 0 ? "ربحت" : "خسرت"}{" "}
            <b>
              <bdi>{formatMoneyNumber(m.netProfit).replace("−", "")}</bdi> د.أ
            </b>{" "}
            من {m.deliveredCount} طلب توصّل، بعد تكلفة البضاعة والمصاريف.
          </p>
        </div>
        <div className="flowsteps">
          <div className="fstep" style={{ ["--i" as string]: 0 }}>
            <span>{toFils(m.returns) > 0 ? "المبيعات بعد المرتجعات" : "المبيعات"}</span>
            <b>
              <bdi>{formatMoneyNumber(m.netSales)}</bdi>
            </b>
          </div>
          <div className="fstep minus" style={{ ["--i" as string]: 1 }}>
            <span>− تكلفة البضاعة</span>
            <b>
              <bdi>{formatMoneyNumber(m.cogs)}</bdi>
            </b>
          </div>
          <div className="fstep minus" style={{ ["--i" as string]: 2 }}>
            <span>− المصاريف</span>
            <b>
              <bdi>{formatMoneyNumber(m.expenses)}</bdi>
            </b>
          </div>
          <div className="fstep result" style={{ ["--i" as string]: 3 }}>
            <span>= الصافي</span>
            <b>
              <bdi>{formatMoneyNumber(m.netProfit)}</bdi>
            </b>
          </div>
        </div>
      </section>
      <div className="grid g-3">
        <MetricCard
          icon="cash"
          tone="olive"
          label="المبيعات"
          value={formatMoneyNumber(m.netSales)}
          unit="د.أ"
          foot={
            toFils(m.returns) > 0
              ? `${formatMoneyNumber(m.sales)} مبيعات − ${formatMoneyNumber(m.returns)} مرتجعات`
              : `متوقع كمان ${formatMoneyNumber(m.expectedSales)} د.أ من طلبات لسا ما توصّلت`
          }
        />
        <MetricCard
          icon="wallet"
          tone="brick"
          label="المصاريف"
          value={formatMoneyNumber(m.expenses)}
          unit="د.أ"
          to="/finance/expenses"
        />
        <MetricCard
          icon="chart-bar"
          tone="green"
          label="إجمالي الربح (قبل المصاريف)"
          value={formatMoneyNumber(m.grossProfit)}
          unit="د.أ"
          foot={`التدفق النقدي ${formatMoneyNumber(m.cashFlow)} د.أ`}
        />
      </div>
      <div className="grid g-main" style={{ gap: 20 }}>
        <article className="card">
          <div className="shead">
            <div className="shead__t">
              <span className="overline">الربح مش دايمًا مصاري بإيدك</span>
              <h2>وين مصاريك؟</h2>
            </div>
          </div>
          <div className="cashbar" role="img" aria-label="توزيع المصاري">
            {cash.map((c, i) => (
              <span
                key={c.label}
                style={{ width: `${cashShares[i]}%`, background: c.color, animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
          <div className="grid g-3" style={{ marginTop: 16 }}>
            {cash.map((c) => (
              <Link key={c.label} to={c.to} style={{ textDecoration: "none", color: "inherit" }}>
                <span className="legend">
                  <span>
                    <i style={{ background: c.color }} />
                    {c.label}
                  </span>
                </span>
                <b style={{ display: "block", font: "var(--lamma-type-number-md)", marginTop: 4 }}>
                  <Money value={c.value} />
                </b>
              </Link>
            ))}
          </div>
          <p className="caption" style={{ marginTop: 12 }}>
            دخل <Money value={m.cashReceived} /> وطلع <Money value={m.cashOut} /> مصاريف بهالفترة.
          </p>
        </article>
        <article className="card">
          <div className="shead">
            <div className="shead__t">
              <span className="overline">{month}</span>
              <h2>المصاريف حسب النوع</h2>
            </div>
            <Link className="shead__more" to="/finance/expenses">
              الكل <Icon name="arrow-left" size={16} />
            </Link>
          </div>
          {cats.length === 0 ? (
            <p className="muted">ما في مصاريف بهالفترة.</p>
          ) : (
            <div className="row" style={{ gap: 18 }}>
              <Donut
                segments={cats.map((c) => ({ label: c.name, value: toFils(c.amount), color: c.color }))}
                center={<bdi>{formatMoneyNumber(m.expenses).split(".")[0]}</bdi>}
                sub="د.أ"
              />
              <div className="col" style={{ gap: 10, flex: 1 }}>
                {cats.map((c, i) => (
                  <div key={c.categoryId} className="row" style={{ gap: 10 }}>
                    <i style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flex: "none" }} />
                    <span className="grow">{c.name}</span>
                    <b className="num" style={{ font: "var(--lamma-type-number-table)" }}>
                      <bdi>{catShares[i]}%</bdi>
                    </b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
      <div className="grid g-3">
        {LINKS.map((l) => (
          <Link key={l.to} className="rcard" to={l.to}>
            <span className={`chipi ${l.tone}`}>
              <Icon name={l.icon} />
            </span>
            <h3>{l.title}</h3>
            <p className="muted">{foot[l.to]}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
