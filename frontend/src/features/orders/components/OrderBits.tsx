import { Link } from "react-router";
import { PaymentBadge } from "@/features/payments";
import { channelIcon } from "@/features/settings";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { Icon } from "@/shared/ui/Icon";
import { Money } from "@/shared/ui/Money";
import type { OrderListItem, OrderStatus } from "../api/ordersApi";
import { FLOW, flowIndex, STATUS } from "../domain/orderDomain";

const dayFormat = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { day: "numeric", month: "long", timeZone: "Asia/Amman" });
const timeFormat = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Amman" });

/** Business-local day (Asia/Amman, D-124) of a UTC timestamp. */
export const orderDate = (utc: string): string => dayFormat.format(new Date(utc));

export const orderDateTime = (utc: string): string => `${dayFormat.format(new Date(utc))} · ${timeFormat.format(new Date(utc))}`;

/** Status badge (prototype `App.statusBadge`); «مرتجع» uses the brick tone. */
export function StatusBadge({ status, large }: { status: OrderStatus; large?: boolean }) {
  const info = STATUS[status];
  if (status === "returned") {
    return (
      <span className={`badge badge--dot${large ? " badge--lg" : ""}`} style={{ background: "var(--lamma-brick-100)", color: "var(--lamma-brick-700)" }}>
        {info.label}
      </span>
    );
  }

  return <span className={`badge badge--dot${large ? " badge--lg" : ""}${info.tone ? ` badge--${info.tone}` : ""}`}>{info.label}</span>;
}

/** Five-dot progress along the flow (prototype `App.track`). */
export function Track({ status }: { status: OrderStatus }) {
  const k = flowIndex(status);
  return (
    <div className="track" aria-label={k < 0 ? STATUS[status].label : `مرحلة ${k + 1} من 5`}>
      {FLOW.map((s, i) => (
        <i key={s} className={k < 0 ? "" : i < k || (i === k && status === "delivered") ? "done" : i === k ? "now" : ""} />
      ))}
    </div>
  );
}

export function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return <span className="avatar avatar--sm">{initials}</span>;
}

/** Product image or the neutral product art (order lines keep no template). */
export function ItemThumb({ imageUrl, size = 40 }: { imageUrl: string | null; size?: number }) {
  return (
    <span className="lowrow__thumb" style={{ width: size, height: size }}>
      {imageUrl ? <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} /> : <Illustration kind="product" template="other" />}
    </span>
  );
}

export function itemsSummary(order: Pick<OrderListItem, "items" | "pieces">): string {
  const first = order.items[0];
  if (!first) return `${order.pieces} قطعة`;
  const more = order.items.length > 1 ? ` +${order.items.length - 1}` : "";
  return `${first.productName}${more} · ${order.pieces} قطعة`;
}

/** Order "shipping label" card (prototype `App.orderCard`). With action buttons inside, use `asLink={false}`: the number links to the order. */
export function OrderCard({ order, index = 0, children, asLink = true }: { order: OrderListItem; index?: number; children?: React.ReactNode; asLink?: boolean }) {
  const body = (
    <>
      <span className="ocard__stamp">
        <Icon name={STATUS[order.status].icon} size={16} />
      </span>
      <div className="row" style={{ gap: 8 }}>
        {asLink ? (
          <span className="ocard__id ltr">#{order.number}</span>
        ) : (
          <Link className="ocard__id ltr" to={`/orders/${order.id}`} style={{ color: "inherit" }}>
            #{order.number}
          </Link>
        )}
        <StatusBadge status={order.status} />
      </div>
      <div className="ocard__who">
        <Initials name={order.customerName} />
        {order.customerName}
        <Icon name={channelIcon[order.channel]} size={16} />
      </div>
      <div className="ocard__meta">
        <span className="caption">{itemsSummary(order)}</span>
        <Money value={order.total} />
      </div>
      <Track status={order.status} />
      <div className="track__lbl">
        <span>{orderDate(order.createdAt)}</span>
        <PaymentBadge status={order.paymentStatus} />
      </div>
      {children}
    </>
  );

  const style = { ["--i" as string]: index };
  return asLink ? (
    <Link className={`ocard st-${order.status}`} to={`/orders/${order.id}`} style={style}>
      {body}
    </Link>
  ) : (
    <div className={`order-card ocard st-${order.status}`} style={style}>
      {body}
    </div>
  );
}
