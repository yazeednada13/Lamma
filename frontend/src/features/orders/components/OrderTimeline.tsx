import { channelLabel } from "@/features/settings";
import { Icon } from "@/shared/ui/Icon";
import type { OrderDetails, OrderStatusChange } from "../api/ordersApi";
import { cancelReasonLabel, STATUS } from "../domain/orderDomain";
import { orderDateTime } from "./OrderBits";

/** One line of the order "thread" (prototype feed), from the server's status log. */
function TimelineEntry({ entry, order }: { entry: OrderStatusChange; order: OrderDetails }) {
  const when = orderDateTime(entry.changedAt);
  if (entry.from === null) {
    return (
      <li className="tone-blue">
        <span className="feed__ic">
          <Icon name="receipt" size={16} />
        </span>
        <div>
          <b>تم إنشاء الطلب</b>
          <span>
            من {channelLabel[order.channel]} · {when}
          </span>
        </div>
      </li>
    );
  }

  if (entry.isUndo) {
    return (
      <li className="tone-apricot">
        <span className="feed__ic">
          <Icon name="arrow-back-up" size={16} />
        </span>
        <div>
          <b>تراجع: رجع لـ «{STATUS[entry.to].label}»</b>
          <span>{when} · رجعت حركات المخزون تلقائيًا</span>
        </div>
      </li>
    );
  }

  const text: Record<string, string> = {
    confirmed: `تلقائي: انحجزت ${order.pieces} قطعة عند التأكيد`,
    preparing: "تغلّف الطلب · قيد التجهيز",
    courier: "طلع مع المندوب",
    delivered: "تم التوصيل · انخصم من المخزون وانحسبت المبيعة",
    cancelled: `انلغى الطلب${entry.cancelReason ? ` · ${cancelReasonLabel(entry.cancelReason)}` : ""}${entry.note ? `: ${entry.note}` : ""}`,
  };
  const tone = entry.to === "delivered" ? "tone-green" : entry.to === "cancelled" ? "tone-brick" : entry.to === "courier" ? "tone-blue" : "tone-olive";
  return (
    <li className={tone}>
      <span className="feed__ic">
        <Icon name={STATUS[entry.to].icon} size={16} />
      </span>
      <div>
        <b>{text[entry.to] ?? `صار «${STATUS[entry.to].label}»`}</b>
        <span>{when}</span>
      </div>
    </li>
  );
}

/** The order "thread" (prototype feed), built from the server's status log. */
export function OrderTimeline({ order }: { order: OrderDetails }) {
  return (
    <article className="card">
      <div className="shead">
        <div className="shead__t">
          <span className="overline">كل شي صار على الطلب</span>
          <h2>الخيط</h2>
        </div>
      </div>
      <ul className="feed">
        {order.timeline.map((entry) => (
          <TimelineEntry key={entry.id} entry={entry} order={order} />
        ))}
      </ul>
    </article>
  );
}
