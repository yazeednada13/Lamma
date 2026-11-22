import { useState } from "react";
import { Link } from "react-router";
import { errorMessage } from "@/services/api/apiClient";
import { ButtonLink } from "@/shared/ui/Button";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { PageHeader } from "@/shared/ui/PageHeader";
import { usePreOrders } from "../api/ordersApi";
import { businessDate } from "../domain/orderDomain";
import { byDay, calendarCells, lastDay, WEEK_DAYS } from "../domain/returnModel";

const dayLabel = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { day: "numeric", month: "long", timeZone: "UTC" });

const RANGES = [
  { days: 14, label: "أسبوعين" },
  { days: 35, label: "الشهر" },
] as const;

/** Pre-orders calendar (prototype `#/preorders`, D-151): open pre-orders on their expected day, today highlighted. */
export function PreOrdersPage() {
  const [days, setDays] = useState<number>(14);
  const today = businessDate(new Date());
  const to = lastDay(today, days);
  const list = usePreOrders(today, to);

  const header = (
    <PageHeader
      title="الطلبات المسبقة"
      subtitle="طلبات بتاريخ تسليم محدد (أكل بيتي، هدايا، صنع حسب الطلب)"
      crumbs={
        <>
          <Link to="/orders">الطلبات</Link> / المسبقة
        </>
      }
      actions={
        <ButtonLink to="/orders/new?preorder=1" icon="plus">
          طلب مسبق
        </ButtonLink>
      }
    />
  );

  if (list.error) {
    return (
      <>
        {header}
        <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />
      </>
    );
  }

  if (!list.data) {
    return (
      <>
        {header}
        <PageSkeleton />
      </>
    );
  }

  const groups = byDay(list.data);
  return (
    <>
      {header}
      <div className="row between" style={{ marginBottom: 12 }}>
        <div className="segmented" role="group" aria-label="الفترة">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              className={days === r.days ? "is-active" : ""}
              aria-pressed={days === r.days}
              onClick={() => setDays(r.days)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className="caption">{list.data.length} طلب مسبق · العربون اختياري (زر «30%» بالطلب الجديد)</span>
      </div>
      <div className="cal">
        {WEEK_DAYS.map((d) => (
          <b key={d} className="caption" style={{ textAlign: "center" }}>
            {d}
          </b>
        ))}
        {calendarCells(today, days).map((day, i) =>
          day === null ? (
            <span key={`blank-${i}`} aria-hidden="true" />
          ) : (
            <div key={day} className={day === today ? "is-today" : undefined}>
              <b>{dayLabel.format(new Date(`${day}T00:00:00Z`))}</b>
              {(groups.get(day) ?? []).map((o) => (
                <Link
                  key={o.id}
                  className="ev"
                  to={`/orders/${o.id}`}
                  style={{ display: "block", textDecoration: "none" }}
                  title={o.items.map((x) => `${x.productName} × ${x.quantity}`).join("، ")}
                >
                  {o.expectedDeliveryTime ? `${o.expectedDeliveryTime} · ` : ""}
                  {o.items[0]?.productName ?? `#${o.number}`} · {o.customerName}
                </Link>
              ))}
            </div>
          ),
        )}
      </div>
    </>
  );
}
