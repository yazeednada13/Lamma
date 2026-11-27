import { Link } from "react-router";
import { errorMessage } from "@/services/api/apiClient";
import { Button, ButtonLink } from "@/shared/ui/Button";
import { flyTo } from "@/shared/ui/celebrate/flyTo";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { Icon } from "@/shared/ui/Icon";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useOrders, useOrderStatusCounts, type OrderStatus } from "../api/ordersApi";
import { OrderCard, StatusBadge } from "../components/OrderBits";
import { StatusSticker } from "../components/StatusSticker";
import { useOrderMove } from "../components/useOrderMove";
import { FLOW, STATUS } from "../domain/orderDomain";

/** Open columns show up to 50 cards; «تم التوصيل» shows the latest 5 (prototype). */
const COLUMN_SIZE = 50;
const DELIVERED_SHOWN = 5;

/** What an empty column says, in the column's own words. */
const EMPTY_TEXT: Partial<Record<OrderStatus, string>> = {
  new: "ما في طلبات جديدة",
  confirmed: "ما في طلبات مستنية تجهيز",
  preparing: "ما في شي بيتغلّف هلّق",
  courier: "ما في شي مع المندوب",
  delivered: "لسا ما وصل ولا طلب",
};

function Column({
  status,
  count,
  move,
  movingId,
}: {
  status: OrderStatus;
  count: number;
  move: ReturnType<typeof useOrderMove>["move"];
  movingId: string | null;
}) {
  const list = useOrders({
    status,
    pageSize: status === "delivered" ? DELIVERED_SHOWN : COLUMN_SIZE,
    sort: status === "delivered" ? "-createdAt" : "createdAt",
  });
  const items = list.data?.items ?? [];
  const more = count - items.length;

  return (
    <div className={`board__col st-${status}`} aria-label={STATUS[status].label}>
      <div className="board__head">
        <StatusBadge status={status} />
        <span className="board__n">{count}</span>
      </div>
      {list.error ? (
        <p className="caption">{errorMessage(list.error)}</p>
      ) : (
        items.map((o) => {
          const next = o.nextStatus;
          return (
            <OrderCard key={o.id} order={o} asLink={false}>
              {next && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={STATUS[next].icon}
                  loading={movingId === o.id}
                  style={{ marginTop: 2 }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Where the card was, captured now: after the move it leaves this column.
                    const from = (e.currentTarget.closest(".ocard") ?? e.currentTarget).getBoundingClientRect();
                    void move(o, next).then((moved) => {
                      if (moved) flyTo(from, document.querySelector(`.board__col.st-${next} .board__head`));
                    });
                  }}
                >
                  {STATUS[next].label}
                </Button>
              )}
            </OrderCard>
          );
        })
      )}
      {more > 0 && (
        <Link className="btn btn--ghost btn--sm" to="/orders">
          + {more} طلب · عرض الكل
        </Link>
      )}
      {list.data && items.length === 0 && (
        <div className="board__empty">
          <StatusSticker status={status} />
          <span className="caption">{EMPTY_TEXT[status] ?? "ما في طلبات هون"}</span>
        </div>
      )}
    </div>
  );
}

/** Status board (prototype `#/orders/board`): one column per step; each card moves only to its next step, with undo. */
export function OrdersBoardPage() {
  const counts = useOrderStatusCounts({});
  const { move, movingId } = useOrderMove();

  return (
    <>
      <PageHeader
        title="لوحة الحالات"
        subtitle="انقل الطلب لحالته الجاية من الزر، والحجز والخصم بيصيروا لحالهم"
        crumbs={
          <>
            <Link to="/orders">الطلبات</Link> / لوحة الحالات
          </>
        }
        actions={
          <>
            <ButtonLink to="/orders" variant="outline" icon="list">
              جدول
            </ButtonLink>
            <ButtonLink to="/orders/new" icon="plus">
              طلب جديد
            </ButtonLink>
          </>
        }
      />
      {counts.error ? (
        <ErrorState message={errorMessage(counts.error)} onRetry={() => void counts.refetch()} />
      ) : (
        <div className="board">
          {FLOW.map((s) => (
            <Column key={s} status={s} count={counts.data?.[s] ?? 0} move={move} movingId={movingId} />
          ))}
        </div>
      )}
      <p className="caption">
        <Icon name="info-circle" size={16} /> تلقائي: عند «مؤكد» القطع بتنحجز · عند «تم التوصيل» بتنخصم من المخزون
        وبتنحسب المبيعة · الملغية بتلاقيها بالجدول.
      </p>
    </>
  );
}
