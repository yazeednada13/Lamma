import { channelIcon, channelLabel, paymentMethodLabel } from "@/features/settings";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { Icon } from "@/shared/ui/Icon";
import type { OrderDetails } from "../api/ordersApi";
import { cancelReasonLabel, FLOW, flowIndex, STATUS } from "../domain/orderDomain";
import { orderDate, StatusBadge } from "./OrderBits";

const LIFE_NOTE: Partial<Record<string, string>> = { confirmed: "انحجزت القطع", delivered: "انخصمت من المخزون" };

/** Shipping-label hero of an order with its lifecycle stepper (prototype `.ohero` + `.life`). */
export function OrderHero({ order: o }: { order: OrderDetails }) {
  const k = flowIndex(o.status);
  const closed = o.status === "cancelled" || o.status === "returned";
  const firstStamp: Partial<Record<string, string>> = {};
  for (const entry of o.timeline) {
    if (!entry.isUndo) firstStamp[entry.to] = orderDate(entry.changedAt);
  }

  const art = o.status === "courier" ? <Illustration kind="delivery" state="courier" /> : o.status === "delivered" ? <Illustration kind="delivery" state="delivered" /> : <Illustration kind="parcel" />;
  return (
        <section className={`ohero st-${o.status}`}>
          <div>
            <span className="ohero__stamp">
              <Icon name="receipt" size={16} />
              <span className="ltr">#{o.number}</span>
            </span>
            <h1>
              {o.customer.name} <StatusBadge status={o.status} large />
            </h1>
            <div className="ohero__meta">
              <span>
                <Icon name="calendar" size={16} /> {orderDate(o.createdAt)}
              </span>
              <span>
                <Icon name={channelIcon[o.channel]} size={16} /> {channelLabel[o.channel]}
              </span>
              <span>
                <Icon name="package" size={16} /> {o.pieces} قطعة
              </span>
              {o.paymentMethod && (
                <span>
                  <Icon name="cash" size={16} /> {paymentMethodLabel[o.paymentMethod]}
                </span>
              )}
            </div>
            {!closed ? (
              <div className="life" style={{ ["--p" as string]: Math.max(0, k) / 4 }}>
                <span className="life__line" />
                <span className="life__fill" />
                {FLOW.map((s, i) => (
                  <div key={s} className={`life__n${i < k || (i === k && s === "delivered") ? " is-done" : i === k ? " is-now" : ""}`}>
                    <span>
                      <Icon name={STATUS[s].icon} />
                    </span>
                    <b>{STATUS[s].label}</b>
                    <small>{i <= k ? (firstStamp[s] ?? "تلقائي") : " "}</small>
                    {i <= k && LIFE_NOTE[s] && (s !== "delivered" || i === k) && <em>{LIFE_NOTE[s]}</em>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 12 }}>
                {o.status === "cancelled"
                  ? `الطلب ملغي${o.cancelReason ? ` (${cancelReasonLabel(o.cancelReason)}${o.cancelNote ? `: ${o.cancelNote}` : ""})` : ""}. القطع المحجوزة رجعت للمتوفر.`
                  : "الطلب مرتجع."}
              </p>
            )}
          </div>
          <div className="ohero__art" style={closed ? { filter: "grayscale(1)", opacity: 0.6 } : undefined}>
            {art}
          </div>
        </section>
  );
}
