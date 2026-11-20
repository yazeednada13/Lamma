import { useEffect, useMemo, useState } from "react";
import { errorMessage } from "@/services/api/apiClient";
import { Button, ButtonLink } from "@/shared/ui/Button";
import { Chip } from "@/shared/ui/Chip";
import { EmptyState } from "@/shared/ui/feedback/EmptyState";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Icon } from "@/shared/ui/Icon";
import { MetricCard } from "@/shared/ui/MetricCard";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useOrders, useOrderStatusCounts, type OrderStatus } from "../api/ordersApi";
import { OrderCard } from "../components/OrderBits";
import { NextButton, OrdersTable } from "../components/OrdersTable";
import { useOrderMove } from "../components/useOrderMove";
import { DATE_PRESETS, presetRange, STATUS, STATUSES, type DatePreset } from "../domain/orderDomain";

const PAGE_SIZE = 25;
const VIEW_KEY = "lamma.orders.view";

function readView(): "table" | "cards" {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "cards" ? "cards" : "table";
  } catch {
    return "table";
  }
}

/** Orders (prototype `#/orders`): open/preparing metrics, status rail with counts, search, period, table or cards. */
export function OrdersPage() {
  const { move, movingId } = useOrderMove();
  const [status, setStatus] = useState<OrderStatus | undefined>();
  const [preset, setPreset] = useState<DatePreset>("all");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"table" | "cards">(readView);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchText]);

  const range = useMemo(() => presetRange(preset, new Date()), [preset]);
  const filters = { search: search || undefined, ...range };
  const counts = useOrderStatusCounts(filters);
  const all = useOrderStatusCounts({});
  const list = useOrders({ ...filters, status, page, pageSize: PAGE_SIZE });

  const chooseView = (next: "table" | "cards") => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // per-viewer convenience only
    }
  };

  const c = counts.data;
  const total = all.data;
  const pages = list.data ? Math.max(1, Math.ceil(list.data.totalCount / PAGE_SIZE)) : 1;
  const open = total ? total.new + total.confirmed + total.preparing + total.courier : 0;

  return (
    <>
      <PageHeader
        title="الطلبات"
        subtitle={total ? `${total.all} طلب · ${open} مفتوحة لهلّق` : undefined}
        actions={
          <>
            <ButtonLink to="/orders/board" variant="outline" icon="layout-kanban">
              لوحة الحالات
            </ButtonLink>
            <ButtonLink to="/orders/new" icon="plus">
              طلب جديد
            </ButtonLink>
          </>
        }
      />
      {counts.error || list.error || all.error ? (
        <ErrorState message={errorMessage(counts.error ?? list.error ?? all.error)} onRetry={() => void Promise.all([counts.refetch(), list.refetch(), all.refetch()])} />
      ) : !c || !list.data || !total ? (
        <PageSkeleton />
      ) : total.all === 0 ? (
        <EmptyState title="لسا ما في طلبات" text="سجّل أول طلب من رسالة واتساب أو إنستغرام، ولمّة بتحجز القطع وبتتابع حالته.">
          <ButtonLink to="/orders/new" icon="plus">
            سجّل أول طلب
          </ButtonLink>
        </EmptyState>
      ) : (
        <>
          <div className="grid g-3">
            <MetricCard icon="receipt" tone="blue" label="جديدة (لسا ما تأكدت)" value={total.new} foot="بدها تأكيد مع الزبون" />
            <MetricCard icon="gift" tone="apricot" label="بالتجهيز" value={total.confirmed + total.preparing} foot="مؤكدة وقطعها محجوزة" to="/orders/board" />
            <MetricCard icon="truck" tone="olive" label="مع المندوب" value={total.courier} foot={`${total.delivered} توصّلت لهلّق`} />
          </div>
          <div className="srail" role="group" aria-label="الحالات">
            <button type="button" className={`sopt sopt--all${!status ? " is-active" : ""}`} onClick={() => { setStatus(undefined); setPage(1); }}>
              <i />الكل <b>{c.all}</b>
            </button>
            {STATUSES.map((s) => (
              <button key={s} type="button" className={`sopt st-${s}${status === s ? " is-active" : ""}`} onClick={() => { setStatus(s); setPage(1); }}>
                <i />
                {STATUS[s].label} <b>{c[s]}</b>
              </button>
            ))}
          </div>
          <div className="table-wrap">
            <div className="toolbar">
              <span className="control control--search" style={{ height: 40, width: "min(300px, 100%)" }}>
                <Icon name="search" />
                <input placeholder="رقم الطلب أو اسم العميل أو رقمه" aria-label="ابحث عن طلب" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
              </span>
              <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="الفترة">
                {DATE_PRESETS.map((p) => (
                  <Chip key={p.code} selected={preset === p.code} onClick={() => { setPreset(p.code); setPage(1); }}>
                    {p.code === "all" && <Icon name="calendar" size={16} />} {p.label}
                  </Chip>
                ))}
              </div>
              <div className="vtoggle end" role="group" aria-label="طريقة العرض">
                <button type="button" className={view === "table" ? "is-active" : ""} aria-label="جدول" aria-pressed={view === "table"} onClick={() => chooseView("table")}>
                  <Icon name="list" size={16} />
                </button>
                <button type="button" className={view === "cards" ? "is-active" : ""} aria-label="ملصقات" aria-pressed={view === "cards"} onClick={() => chooseView("cards")}>
                  <Icon name="layout-grid" size={16} />
                </button>
              </div>
            </div>
            {list.data.items.length === 0 ? (
              <EmptyState title="ما في طلبات هون" text="جرّب تغيّر الفلتر أو البحث." />
            ) : view === "cards" ? (
              <div className="ogrid stagger" style={{ padding: 16 }}>
                {list.data.items.map((o, i) => (
                  <OrderCard key={o.id} order={o} index={i} asLink={false}>
                    {o.nextStatus && (
                      <div style={{ marginTop: 2 }}>
                        <NextButton order={o} move={move} busy={movingId === o.id} />
                      </div>
                    )}
                  </OrderCard>
                ))}
              </div>
            ) : (
              <OrdersTable orders={list.data.items} move={move} movingId={movingId} />
            )}
            <div className="pagination">
              <span>
                عرض <bdi>{list.data.items.length}</bdi> من <bdi>{list.data.totalCount}</bdi>
              </span>
              <span className="caption">رتّبنا الأحدث أول</span>
            </div>
          </div>
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
        </>
      )}
    </>
  );
}
