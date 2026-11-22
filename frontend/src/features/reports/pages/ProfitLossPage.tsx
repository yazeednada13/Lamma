import { Link, useSearchParams } from "react-router";
import { errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber, toFils, type MoneyString } from "@/shared/lib/money";
import { DeltaPill } from "@/shared/ui/charts/DeltaPill";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Money } from "@/shared/ui/Money";
import { PageHeader } from "@/shared/ui/PageHeader";
import { usePnlReport } from "../api/reportsApi";
import { PeriodPicker } from "../components/PeriodPicker";
import { Waterfall } from "../components/Waterfall";
import {
  changeSentence,
  compareLabel,
  periodSearch,
  periodSubtitle,
  readPeriod,
  waterfallSteps,
  type PeriodSelection,
} from "../domain/reportsDomain";

const neg = (m: MoneyString): MoneyString => (m.startsWith("-") ? m.slice(1) : toFils(m) === 0 ? m : `-${m}`);

/** Profit and loss (prototype `#/reports/pnl`, D-168–D-170): hero, waterfall, ledger, «شو تغيّر؟». */
export function ProfitLossPage() {
  const [params, setParams] = useSearchParams();
  const selection = readPeriod(params);
  const report = usePnlReport(selection);
  const choose = (s: PeriodSelection) => setParams(new URLSearchParams(periodSearch(s)));

  const crumbs = (
    <>
      <Link to="/reports">التقارير</Link> / الأرباح والخسائر
    </>
  );
  const r = report.data;
  const header = (
    <PageHeader
      title="الأرباح والخسائر"
      subtitle={r ? `${periodSubtitle(r.period)} · المبيعة بتنحسب عند التوصيل` : "المبيعة بتنحسب عند التوصيل"}
      crumbs={crumbs}
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

  const c = r.current;
  const net = toFils(c.netProfit);
  const cats = r.expensesByCategory.filter((x) => toFils(x.current) !== 0);
  const compare: { label: string; change: number | null; invert?: boolean }[] = [
    { label: "المبيعات", change: r.changes.sales },
    { label: "تكلفة البضاعة", change: r.changes.cogs, invert: true },
    { label: "المصاريف", change: r.changes.expenses, invert: true },
    { label: "صافي الربح", change: r.changes.netProfit },
  ];

  return (
    <>
      {header}
      <PeriodPicker value={selection} onChange={choose} />
      <section className="lhero" style={{ opacity: report.isPlaceholderData ? 0.6 : 1 }}>
        <div>
          <span className="overline">صافي {net >= 0 ? "الربح" : "الخسارة"}</span>
          <div className="lhero__net">
            <bdi>{formatMoneyNumber(c.netProfit)}</bdi> <small>د.أ</small>
          </div>
          <p>
            {c.deliveredCount} طلب توصّل بهالفترة
            {toFils(c.returns) > 0 ? <>، ورجع منها بقيمة <bdi>{formatMoneyNumber(c.returns)}</bdi> د.أ</> : ""}.
          </p>
        </div>
        <div className="flowsteps">
          <div className="fstep" style={{ ["--i" as string]: 0 }}>
            <span>صافي المبيعات</span>
            <b>
              <bdi>{formatMoneyNumber(c.netSales)}</bdi>
            </b>
          </div>
          <div className="fstep" style={{ ["--i" as string]: 1 }}>
            <span>إجمالي الربح</span>
            <b>
              <bdi>{formatMoneyNumber(c.grossProfit)}</bdi>
            </b>
          </div>
          <div className="fstep minus" style={{ ["--i" as string]: 2 }}>
            <span>− المصاريف</span>
            <b>
              <bdi>{formatMoneyNumber(c.expenses)}</bdi>
            </b>
          </div>
          <div className="fstep result" style={{ ["--i" as string]: 3 }}>
            <span>= الصافي</span>
            <b>
              <bdi>{formatMoneyNumber(c.netProfit)}</bdi>
            </b>
          </div>
        </div>
      </section>

      <article className="card">
        <div className="shead">
          <div className="shead__t">
            <span className="overline">من المبيعات للصافي</span>
            <h2>شلال الربح</h2>
          </div>
          <span className="legend">
            <span>
              <i style={{ background: "var(--lamma-olive-600)" }} />
              مجموع
            </span>
            <span>
              <i style={{ background: "var(--lamma-brick-500)" }} />
              طالع
            </span>
            <span>
              <i style={{ background: "var(--lamma-apricot-500)" }} />
              الصافي
            </span>
          </span>
        </div>
        {toFils(c.sales) === 0 && cats.length === 0 && toFils(c.returns) === 0 ? (
          <p className="muted">ما في مبيعات ولا مصاريف بهالفترة.</p>
        ) : (
          <Waterfall steps={waterfallSteps(c, cats)} />
        )}
      </article>

      <div className="grid g-main" style={{ gap: 20 }}>
        <div className="card ledger">
          <table className="pnl">
            <tbody>
              <tr>
                <td>المبيعات ({c.deliveredCount} طلب)</td>
                <td>
                  <Money value={c.sales} />
                </td>
              </tr>
              <tr className="minus">
                <td>− المرتجعات</td>
                <td>
                  <Money value={neg(c.returns)} />
                </td>
              </tr>
              <tr className="sub">
                <td>صافي المبيعات</td>
                <td>
                  <Money value={c.netSales} />
                </td>
              </tr>
              <tr className="minus">
                <td>− تكلفة البضاعة المباعة</td>
                <td>
                  <Money value={neg(c.cogs)} />
                </td>
              </tr>
              <tr className="sub">
                <td>إجمالي الربح</td>
                <td>
                  <Money value={c.grossProfit} />
                </td>
              </tr>
              {cats.map((x) => (
                <tr key={x.categoryId} className="minus">
                  <td>− {x.name}</td>
                  <td>
                    <Money value={neg(x.current)} />
                  </td>
                </tr>
              ))}
              <tr className="total">
                <td>صافي الربح</td>
                <td>
                  <Money value={c.netProfit} tone={net >= 0 ? "pos" : "neg"} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="col" style={{ gap: 16 }}>
          <article className="card">
            <div className="shead">
              <div className="shead__t">
                <span className="overline">{compareLabel(r.period)}</span>
                <h2>شو تغيّر؟</h2>
              </div>
            </div>
            {r.hasPrevious ? (
              <div className="col" style={{ gap: 12 }}>
                {compare.map((x) => (
                  <div key={x.label} className="row between">
                    <span>{x.label}</span>
                    <DeltaPill change={x.change} invert={x.invert} />
                  </div>
                ))}
                <p className="caption">{changeSentence(r)}</p>
              </div>
            ) : (
              <p className="muted">ما في فترة سابقة للمقارنة.</p>
            )}
          </article>
          {r.expectedSales !== null && toFils(r.expectedSales) > 0 && (
            <div className="insight">
              <span className="overline">مبيعات متوقعة</span>
              <p>
                عندك <b>{<Money value={r.expectedSales} />}</b> بطلبات مؤكدة لسا ما توصّلت، مش داخلة بالربح لحد التوصيل.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
