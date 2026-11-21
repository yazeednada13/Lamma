import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber } from "@/shared/lib/money";
import { Button } from "@/shared/ui/Button";
import { Chip } from "@/shared/ui/Chip";
import { useConfirm } from "@/shared/ui/confirm/ConfirmProvider";
import { EmptyState } from "@/shared/ui/feedback/EmptyState";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Icon } from "@/shared/ui/Icon";
import { Money } from "@/shared/ui/Money";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useExpenses, useExpenseSummary, useFinanceOverview, useVoidExpense, type Expense } from "../api/financeApi";
import { AddExpenseDrawer } from "../components/AddExpenseDrawer";
import {
  barWidths,
  categoryIcon,
  CHART_COLORS,
  CHIP_TONES,
  dayLabel,
  expenseInsight,
  groupByDay,
  monthLabel,
  percentShares,
  PERIOD_PRESETS,
  periodRange,
  type PeriodPreset,
} from "../domain/financeDomain";

const PAGE_SIZE = 50;

/** Expenses (prototype `#/finance/expenses`): period total and bars per category, Lamma note, category filter, list by day. */
export function ExpensesPage() {
  const [params, setParams] = useSearchParams();
  const [preset, setPreset] = useState<PeriodPreset>("month");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();
  const voidExpense = useVoidExpense();

  const range = periodRange(preset);
  const summary = useExpenseSummary(range);
  const overview = useFinanceOverview(range);
  const list = useExpenses({ ...range, categoryId, page, pageSize: PAGE_SIZE });

  // «مصروف» from the quick actions and the overview opens the drawer (/finance/expenses?add=1).
  const fromLink = params.has("add");
  const drawerOpen = adding || fromLink;
  const closeDrawer = () => {
    setAdding(false);
    if (fromLink) setParams({}, { replace: true });
  };

  const header = (
    <PageHeader
      title="المصاريف"
      subtitle={summary.data ? `${monthLabel(range.from)} · ${summary.data.count} مصروف` : undefined}
      crumbs={
        <>
          <Link to="/finance">المالية</Link> / المصاريف
        </>
      }
      actions={
        <Button icon="plus" onClick={() => setAdding(true)}>
          مصروف
        </Button>
      }
    />
  );
  const drawer = (
    <AddExpenseDrawer open={drawerOpen} onClose={closeDrawer} lastCategoryId={summary.data?.lastCategoryId ?? null} />
  );

  if (summary.error || list.error) {
    return (
      <>
        {header}
        <ErrorState
          message={errorMessage(summary.error ?? list.error)}
          onRetry={() => void Promise.all([summary.refetch(), list.refetch()])}
        />
        {drawer}
      </>
    );
  }

  if (!summary.data || !list.data) {
    return (
      <>
        {header}
        <PageSkeleton />
        {drawer}
      </>
    );
  }

  const cats = summary.data.byCategory;
  const widths = barWidths(cats.map((c) => c.amount));
  const shares = percentShares(cats.map((c) => c.amount));
  const pages = Math.max(1, Math.ceil(list.data.totalCount / PAGE_SIZE));

  const remove = async (e: Expense) => {
    const done = await confirm({
      tone: "danger",
      icon: "trash",
      title: "إلغاء المصروف؟",
      subject: `${e.categoryName} · ${formatMoneyNumber(e.amount)} د.أ`,
      message: "المصروف بيضل بالسجل بس ما بينحسب بالمصاريف والأرباح.",
      confirmLabel: "إلغاء المصروف",
      cancelLabel: "رجوع",
      action: () => voidExpense.mutateAsync({ id: e.id, reason: null }),
    });
    if (done) toast("انلغى المصروف", { type: "info" });
  };

  return (
    <>
      {header}
      <div className="row wrap" style={{ gap: 6, marginBottom: 12 }} role="group" aria-label="الفترة">
        {PERIOD_PRESETS.map((p) => (
          <Chip
            key={p.code}
            selected={preset === p.code}
            onClick={() => {
              setPreset(p.code);
              setPage(1);
            }}
          >
            {p.code === "month" && <Icon name="calendar" size={16} />} {p.label}
          </Chip>
        ))}
      </div>
      <div className="grid g-main" style={{ gap: 20 }}>
        <article className="card">
          <div className="shead">
            <div className="shead__t">
              <span className="overline">{preset === "month" ? "مجموع الشهر" : `مجموع ${monthLabel(range.from)}`}</span>
              <h2>
                <Money value={summary.data.total} />
              </h2>
            </div>
          </div>
          {cats.length === 0 ? (
            <p className="muted">ما في مصاريف بهالفترة.</p>
          ) : (
            <div className="col" style={{ gap: 14 }}>
              {cats.map((c, i) => (
                <div key={c.categoryId} className="xcat">
                  <span className={`chipi ${CHIP_TONES[i % CHIP_TONES.length]}`}>
                    <Icon name={categoryIcon(c.code)} size={16} />
                  </span>
                  <div>
                    <div className="row between">
                      <b style={{ font: "var(--lamma-type-label)" }}>{c.name}</b>
                      <span className="caption">
                        <bdi>{shares[i]}%</bdi>
                      </span>
                    </div>
                    <div className="flowbar">
                      <span
                        style={{
                          width: `${widths[i]}%`,
                          background: CHART_COLORS[i % CHART_COLORS.length],
                          animationDelay: `${i * 90}ms`,
                        }}
                      />
                    </div>
                  </div>
                  <Money value={c.amount} />
                </div>
              ))}
            </div>
          )}
        </article>
        <div className="insight">
          <span className="overline">ملاحظة لمّة</span>
          <p>{expenseInsight(cats[0], summary.data.total, overview.data?.sales)}</p>
        </div>
      </div>
      <div className="row wrap" style={{ gap: 6, margin: "16px 0 4px" }} role="group" aria-label="التصنيف">
        <Chip
          selected={!categoryId}
          onClick={() => {
            setCategoryId(undefined);
            setPage(1);
          }}
        >
          الكل
        </Chip>
        {cats.map((c) => (
          <Chip
            key={c.categoryId}
            selected={categoryId === c.categoryId}
            onClick={() => {
              setCategoryId(c.categoryId);
              setPage(1);
            }}
          >
            {c.name}
          </Chip>
        ))}
      </div>
      {list.data.items.length === 0 ? (
        <EmptyState title="ما في مصاريف" text="سجّل أول مصروف عشان نحسبلك الربح الحقيقي." />
      ) : (
        groupByDay(list.data.items, (e) => e.spentOn).map((g) => (
          <div key={g.day}>
            <div className="mday">{dayLabel(g.day)}</div>
            {g.items.map((e, i) => (
              <div
                key={e.id}
                className="mrow out"
                style={{
                  ["--i" as string]: i,
                  gridTemplateColumns: "40px minmax(0,1fr) auto auto",
                  opacity: e.isVoided ? 0.55 : 1,
                }}
              >
                <span className="mrow__ic">
                  <Icon name={e.source === "courier_settlement" ? "truck" : "wallet"} />
                </span>
                <span>
                  <b style={e.isVoided ? { textDecoration: "line-through" } : undefined}>{e.note ?? e.categoryName}</b>
                  <br />
                  <span className="caption">
                    {e.categoryName}
                    {e.source === "courier_settlement" ? " · من تسوية شركة التوصيل" : ""}
                    {e.isVoided ? " · ملغي" : ""}
                  </span>
                </span>
                <span className="mrow__q" style={e.isVoided ? { textDecoration: "line-through" } : undefined}>
                  <Money value={`-${e.amount}`} />
                </span>
                <span>
                  {!e.isVoided && e.source === "manual" && (
                    <Button variant="ghost" size="sm" onClick={() => void remove(e)}>
                      إلغاء
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        ))
      )}
      {pages > 1 && (
        <nav className="row" style={{ justifyContent: "center", gap: 12, marginTop: 16 }} aria-label="الصفحات">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            السابق
          </Button>
          <span className="caption">
            صفحة <bdi>{page}</bdi> من <bdi>{pages}</bdi>
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            التالي
          </Button>
        </nav>
      )}
      {drawer}
    </>
  );
}
