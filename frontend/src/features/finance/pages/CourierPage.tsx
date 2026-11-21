import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber, toFils } from "@/shared/lib/money";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { Button } from "@/shared/ui/Button";
import { useConfirm } from "@/shared/ui/confirm/ConfirmProvider";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Icon } from "@/shared/ui/Icon";
import { Money } from "@/shared/ui/Money";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useCourier, useReverseSettlement, useSettlements, type Settlement } from "../api/financeApi";
import { SettlementDrawer } from "../components/SettlementDrawer";
import { dayLabel } from "../domain/financeDomain";

const deliveredDay = new Intl.DateTimeFormat("ar-JO-u-nu-latn", {
  day: "numeric",
  month: "long",
  timeZone: "Asia/Amman",
});

/** Courier company (prototype `#/finance/courier`, D-139–D-141): money held, orders waiting, transfers and their reversal. */
export function CourierPage() {
  const navigate = useNavigate();
  const courier = useCourier();
  const [page, setPage] = useState(1);
  const settlements = useSettlements(page);
  const reverse = useReverseSettlement();
  const confirm = useConfirm();
  const toast = useToast();
  const [settling, setSettling] = useState(false);

  const c = courier.data;
  const header = (
    <PageHeader
      title="مستحقات شركة التوصيل"
      subtitle={c ? `${c.companyName} · بتجمع «عند الاستلام» وبتحوّل بعدين` : undefined}
      crumbs={
        <>
          <Link to="/finance">المالية</Link> / شركة التوصيل
        </>
      }
      actions={
        <Button icon="building-bank" disabled={!c || c.waitingCount === 0} onClick={() => setSettling(true)}>
          تسجيل تحويل
        </Button>
      }
    />
  );

  if (courier.error || settlements.error) {
    return (
      <>
        {header}
        <ErrorState
          message={errorMessage(courier.error ?? settlements.error)}
          onRetry={() => void Promise.all([courier.refetch(), settlements.refetch()])}
        />
      </>
    );
  }

  if (!c || !settlements.data) {
    return (
      <>
        {header}
        <PageSkeleton />
      </>
    );
  }

  const last = c.lastSettlement;
  const pages = Math.max(1, Math.ceil(settlements.data.totalCount / 10));

  const undo = async (s: Settlement) => {
    const done = await confirm({
      tone: "danger",
      icon: "arrow-back-up",
      title: "إلغاء التسوية؟",
      subject: `${formatMoneyNumber(s.receivedAmount)} د.أ · ${s.orders.length} طلبات`,
      message: `الطلبات بترجع «عند الشركة» وبتنلغى دفعاتها${toFils(s.difference) > 0 ? "، ومصروف الفرق بينلغى كمان" : ""}. التسوية بتضل بالسجل.`,
      confirmLabel: "إلغاء التسوية",
      cancelLabel: "رجوع",
      action: () => reverse.mutateAsync({ id: s.id, reason: null }),
    });
    if (done) toast("انلغت التسوية ورجعت الطلبات «عند الشركة»", { type: "info" });
  };

  return (
    <>
      {header}
      <section className="ohero st-courier">
        <div>
          <span className="ohero__stamp">
            <Icon name="truck" size={16} /> {c.companyName}
          </span>
          <h1>
            <Money value={c.held} /> إلك عند الشركة
          </h1>
          <div className="ohero__meta">
            <span>
              <Icon name="receipt" size={16} /> {c.waitingCount} طلبات بانتظار التحويل
            </span>
            {toFils(c.onTheWay) > 0 && (
              <span>
                <Icon name="truck" size={16} /> مع المندوب <Money value={c.onTheWay} /> ({c.onTheWayCount})
              </span>
            )}
            <span>
              <Icon name="building-bank" size={16} />{" "}
              {last ? (
                <>
                  آخر تحويل <Money value={last.receivedAmount} /> · {dayLabel(last.settledOn)}
                </>
              ) : (
                "لسا ما في تحويلات"
              )}
            </span>
            <span>
              <Icon name="wallet" size={16} /> رسوم الشهر <Money value={c.monthFees} />
            </span>
          </div>
        </div>
        <div className="ohero__art">
          <Illustration kind="delivery" state="courier" />
        </div>
      </section>
      <div className="grid g-2">
        <div className="table-wrap">
          <div className="toolbar">
            <h3>بانتظار التحويل</h3>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>الطلب</th>
                <th>العميل</th>
                <th>تم التوصيل</th>
                <th className="num">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {c.waiting.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    ما في مستحقات عند الشركة.
                  </td>
                </tr>
              ) : (
                c.waiting.map((o) => (
                  <tr key={o.orderId} onClick={() => navigate(`/orders/${o.orderId}`)} style={{ cursor: "pointer" }}>
                    <td className="ltr">
                      <b>#{o.number}</b>
                    </td>
                    <td>{o.customerName}</td>
                    <td className="caption">{deliveredDay.format(new Date(o.deliveredAt))}</td>
                    <td className="num">
                      <Money value={o.remaining} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <article className="card">
          <div className="shead">
            <div className="shead__t">
              <span className="overline">سجل</span>
              <h2>التحويلات السابقة</h2>
            </div>
          </div>
          {settlements.data.items.length === 0 ? (
            <p className="muted">لسا ما سجّلت تحويلات.</p>
          ) : (
            <ul className="feed">
              {settlements.data.items.map((s) => (
                <li
                  key={s.id}
                  className={s.isReversed ? "tone-brick" : "tone-green"}
                  style={s.isReversed ? { opacity: 0.6 } : undefined}
                >
                  <span className="feed__ic">
                    <Icon name={s.isReversed ? "arrow-back-up" : "building-bank"} size={16} />
                  </span>
                  <div className="grow">
                    <b style={s.isReversed ? { textDecoration: "line-through" } : undefined}>
                      <Money value={s.receivedAmount} />
                    </b>
                    <span>
                      {dayLabel(s.settledOn)} · {s.orders.length} طلبات
                      {toFils(s.difference) > 0 ? ` · رسوم ${formatMoneyNumber(s.difference)}` : ""}
                      {s.isReversed ? " · ملغية" : ""}
                    </span>
                  </div>
                  {!s.isReversed && (
                    <Button variant="ghost" size="sm" onClick={() => void undo(s)}>
                      إلغاء
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {pages > 1 && (
            <div className="row" style={{ justifyContent: "center", gap: 12, marginTop: 12 }}>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                الأحدث
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                الأقدم
              </Button>
            </div>
          )}
        </article>
      </div>
      {settling && (
        <SettlementDrawer
          open={settling}
          onClose={() => setSettling(false)}
          orders={c.waiting}
          companyName={c.companyName}
        />
      )}
    </>
  );
}
