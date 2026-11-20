import { useNavigate } from "react-router";
import { channelIcon, channelLabel } from "@/features/settings";
import { Button } from "@/shared/ui/Button";
import { Icon } from "@/shared/ui/Icon";
import { Money } from "@/shared/ui/Money";
import type { OrderListItem } from "../api/ordersApi";
import { STATUS } from "../domain/orderDomain";
import { Initials, ItemThumb, orderDate, StatusBadge, Track } from "./OrderBits";
import type { useOrderMove } from "./useOrderMove";

type Move = ReturnType<typeof useOrderMove>["move"];

export /** Next-step button of a row or card (prototype `App.quickNext`), with undo in the toast. */
function NextButton({ order, move, busy }: { order: OrderListItem; move: Move; busy: boolean }) {
  if (!order.nextStatus) return null;
  const next = order.nextStatus;
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={busy}
      iconEnd="arrow-left"
      title={`نقل لـ «${STATUS[next].label}»`}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        void move(order, next);
      }}
    >
      {STATUS[next].label}
    </Button>
  );
}

/** Orders table (prototype `App.ordersTable`): label, customer, items, status, track, total, next step. */
export function OrdersTable({ orders, move, movingId }: { orders: OrderListItem[]; move: Move; movingId: string | null }) {
  const navigate = useNavigate();
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>الطلب</th>
          <th>العميل</th>
          <th className="hide-md">المنتجات</th>
          <th>الحالة</th>
          <th className="hide-md">المسار</th>
          <th className="num">المجموع</th>
          <th className="num hide-sm">
            <span className="sr-only">الخطوة الجاية</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => {
          const first = o.items[0];
          return (
            <tr key={o.id} className={`st-${o.status}`} onClick={() => navigate(`/orders/${o.id}`)} style={{ cursor: "pointer" }}>
              <td>
                <span className="o-id">
                  <span>
                    <a href={`/orders/${o.id}`} onClick={(e) => { e.preventDefault(); navigate(`/orders/${o.id}`); }} style={{ color: "inherit", textDecoration: "none" }}>
                      <b className="ltr">#{o.number}</b>
                    </a>
                    <br />
                    <span className="caption">{orderDate(o.createdAt)}</span>
                  </span>
                </span>
              </td>
              <td>
                <div className="row" style={{ gap: 8 }}>
                  <Initials name={o.customerName} />
                  <span>
                    {o.customerName}
                    <br />
                    <span className="caption row" style={{ gap: 4 }}>
                      <Icon name={channelIcon[o.channel]} size={16} />
                      {channelLabel[o.channel]}
                    </span>
                  </span>
                </div>
              </td>
              <td className="hide-md">
                {first && (
                  <div className="cell-product">
                    <ItemThumb imageUrl={null} />
                    <span>
                      {first.productName}
                      {o.items.length > 1 ? ` +${o.items.length - 1}` : ""}
                      <br />
                      <span className="caption">
                        {first.variantLabel ?? "—"} × {first.quantity}
                      </span>
                    </span>
                  </div>
                )}
              </td>
              <td>
                <StatusBadge status={o.status} />
              </td>
              <td className="hide-md">
                <Track status={o.status} />
              </td>
              <td className="num">
                <Money value={o.total} />
              </td>
              <td className="num hide-sm">
                <span className="row-act">
                  <NextButton order={o} move={move} busy={movingId === o.id} />
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
