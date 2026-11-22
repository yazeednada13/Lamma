import { Link, useSearchParams } from "react-router";
import { channelLabel } from "@/features/settings";
import { errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber, toFils } from "@/shared/lib/money";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { AreaChart } from "@/shared/ui/charts/AreaChart";
import { DeltaPill } from "@/shared/ui/charts/DeltaPill";
import { Donut } from "@/shared/ui/charts/Donut";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { Money } from "@/shared/ui/Money";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useSalesReport } from "../api/reportsApi";
import { PeriodPicker } from "../components/PeriodPicker";
import {
  bucketLabel,
  periodSearch,
  periodSubtitle,
  readPeriod,
  shares,
  WEEK_ORDER,
  WEEKDAYS,
  type PeriodSelection,
} from "../domain/reportsDomain";

const COLORS = ["var(--lamma-chart-1)", "var(--lamma-chart-2)", "var(--lamma-chart-3)", "var(--lamma-chart-4)", "var(--lamma-chart-5)"] as const;

/** Sales report (prototype `#/reports/sales`, D-171): chart, channels, weekdays, product performance, AOV. */
export function SalesReportPage() {
  const [params, setParams] = useSearchParams();
  const selection = readPeriod(params);
  const report = useSalesReport(selection);
  const choose = (s: PeriodSelection) => setParams(new URLSearchParams(periodSearch(s)));
  const r = report.data;
  const header = (
    <PageHeader
      title="تقرير المبيعات"
      subtitle={r ? `${periodSubtitle(r.period)} · حسب التوصيل` : "حسب التوصيل"}
      crumbs={
        <>
          <Link to="/reports">التقارير</Link> / المبيعات
        </>
      }
    />
  );

  if (report.error) {
    return (
      <>
        {header}
        <PeriodPicker value={selection} onChange={choose} />
        <ErrorState message={errorMessage(report.error)} onRetry={() => void report.refetch()} />
      </>
    );
  }

  if (!r) {
    return (
      <>
        {header}
        <PageSkeleton />
      </>
    );
  }

  const channelShares = shares(r.channels.map((c) => c.amount));
  const segments = r.channels
    .filter((c) => toFils(c.amount) > 0)
    .map((c, i) => ({ label: channelLabel[c.channel], value: toFils(c.amount), color: COLORS[i % COLORS.length]! }));
  const wMax = Math.max(1, ...r.weekdays.map((w) => toFils(w)));
  const pMax = Math.max(1, ...r.products.map((p) => toFils(p.revenue)));
  const metrics: { icon: IconName; tone: string; label: string; value: string; unit?: string; change: number | null }[] = [
    { icon: "cash", tone: "olive", label: "صافي المبيعات", value: formatMoneyNumber(r.netSales), unit: "د.أ", change: r.netSalesChange },
    { icon: "receipt", tone: "blue", label: "طلبات توصّلت", value: String(r.orders), change: r.ordersChange },
    { icon: "chart-bar", tone: "green", label: "متوسط قيمة الطلب", value: formatMoneyNumber(r.averageOrderValue), unit: "د.أ", change: r.averageOrderValueChange },
  ];

  return (
    <div style={{ opacity: report.isPlaceholderData ? 0.6 : 1 }}>
      {header}
      <PeriodPicker value={selection} onChange={choose} />

      <div className="grid g-3">
        {metrics.map((m) => (
          <article key={m.label} className={`card metric tone-${m.tone} metric--row`}>
            <span className="chipi">
              <Icon name={m.icon} />
            </span>
            <div style={{ minWidth: 0 }}>
              <span className="metric__label">{m.label}</span>
              <div className="metric__value">
                <bdi>{m.value}</bdi>
                {m.unit && <span className="metric__unit">{m.unit}</span>}
                <DeltaPill change={m.change} />
              </div>
            </div>
          </article>
        ))}
      </div>

      <article className="card" style={{ padding: 20 }}>
        <div className="shead">
          <div className="shead__t">
            <span className="overline">{r.period.bucket === "month" ? "حسب الشهر" : "حسب يوم التوصيل"}</span>
            <h2>المبيعات والربح</h2>
          </div>
          <span className="legend">
            <span>
              <i style={{ background: "var(--lamma-chart-1)" }} />
              المبيعات
            </span>
            <span>
              <i style={{ background: "var(--lamma-chart-2)" }} />
              الربح
            </span>
          </span>
        </div>
        <AreaChart
          ariaLabel="المبيعات والربح"
          points={r.series.map((b) => ({
            key: b.start,
            label: bucketLabel(b.start, r.period),
            a: toFils(b.sales),
            b: toFils(b.grossProfit),
            tip: (
              <>
                <b>{bucketLabel(b.start, r.period)}</b>
                المبيعات: <bdi>{formatMoneyNumber(b.sales)}</bdi> د.أ
                <br />
                الربح: <bdi>{formatMoneyNumber(b.grossProfit)}</bdi> د.أ
              </>
            ),
          }))}
        />
      </article>

      <div className="grid g-2">
        <article className="card">
          <div className="shead">
            <div className="shead__t">
              <span className="overline">بعد المرتجعات</span>
              <h2>حسب القناة</h2>
            </div>
          </div>
          {segments.length === 0 ? (
            <p className="muted">ما توصّل ولا طلب بهالفترة.</p>
          ) : (
            <div className="row" style={{ gap: 18 }}>
              <Donut segments={segments} center={<bdi>{formatMoneyNumber(r.netSales).split(".")[0]}</bdi>} sub="د.أ" />
              <div className="col" style={{ gap: 10, flex: 1 }}>
                {r.channels.map((c, i) => (
                  <div key={c.channel} className="row" style={{ gap: 10 }}>
                    <i style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[i % COLORS.length], flex: "none" }} />
                    <span className="grow">
                      {channelLabel[c.channel]} <span className="caption">· {c.orders} طلب</span>
                    </span>
                    <b className="num" style={{ font: "var(--lamma-type-number-table)" }}>
                      <bdi>{channelShares[i]}%</bdi>
                    </b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </article>
        <article className="card">
          <div className="shead">
            <div className="shead__t">
              <span className="overline">بهالفترة</span>
              <h2>{r.bestWeekday === null ? "أقوى يوم" : `أقوى يوم: ${WEEKDAYS[r.bestWeekday]}`}</h2>
            </div>
          </div>
          <div className="wbars">
            {WEEK_ORDER.map((d, i) => (
              <div key={d} className={d === r.bestWeekday ? "is-best" : ""} title={`${formatMoneyNumber(r.weekdays[d] ?? "0")} د.أ`}>
                <i style={{ height: `${Math.max(4, (Math.max(0, toFils(r.weekdays[d] ?? "0")) / wMax) * 100)}%`, animationDelay: `${i * 60}ms` }} />
                <span>{WEEKDAYS[d]}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="card" id="products">
        <div className="shead">
          <div className="shead__t">
            <span className="overline">بعد الخصم والمرتجعات</span>
            <h2>أداء المنتجات</h2>
          </div>
          <span className="caption">المبيعات · الربح</span>
        </div>
        {r.products.length === 0 ? (
          <p className="muted">بيظهر هون أول ما تتوصّل طلبات بهالفترة.</p>
        ) : (
          <div className="col" style={{ gap: 14 }}>
            {r.products.map((p, i) => (
              <Link
                key={p.productId}
                to={`/products/${p.productId}`}
                className="xcat"
                style={{ textDecoration: "none", color: "inherit", gridTemplateColumns: "44px minmax(0,1fr) auto auto", gap: 14 }}
              >
                <span className="lowrow__thumb" style={{ width: 44, height: 44 }}>
                  <Illustration kind="product" template="other" />
                </span>
                <div>
                  <div className="row between">
                    <b style={{ font: "var(--lamma-type-label)" }}>{p.name}</b>
                    <span className="caption">{p.quantity} قطعة</span>
                  </div>
                  <div className="flowbar">
                    <span
                      style={{
                        width: `${(Math.max(0, toFils(p.revenue)) / pMax) * 100}%`,
                        background: `var(--lamma-chart-${i ? 1 : 2})`,
                        animationDelay: `${Math.min(i, 12) * 70}ms`,
                      }}
                    />
                  </div>
                </div>
                <Money value={p.revenue} />
                <span className="pcard__margin">
                  <Money value={p.grossProfit} />
                </span>
              </Link>
            ))}
            {r.otherProducts && (
              <div className="xcat" style={{ gridTemplateColumns: "44px minmax(0,1fr) auto auto", gap: 14 }}>
                <span />
                <div>
                  <b style={{ font: "var(--lamma-type-label)" }}>باقي المنتجات ({r.otherProducts.count})</b>
                  <br />
                  <span className="caption">{r.otherProducts.quantity} قطعة</span>
                </div>
                <Money value={r.otherProducts.revenue} />
                <span className="pcard__margin">
                  <Money value={r.otherProducts.grossProfit} />
                </span>
              </div>
            )}
          </div>
        )}
        {toFils(r.deliveryFees) > 0 && (
          <p className="caption" style={{ marginTop: 12 }}>
            أجور التوصيل <bdi>{formatMoneyNumber(r.deliveryFees)}</bdi> د.أ داخلة بالمبيعات ومش محسوبة على أي منتج.
          </p>
        )}
      </article>
    </div>
  );
}
