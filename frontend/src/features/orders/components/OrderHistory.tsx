import { errorMessage } from "@/services/api/apiClient";
import { ButtonLink } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/feedback/EmptyState";
import { Skeleton } from "@/shared/ui/feedback/Skeleton";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { useOrders } from "../api/ordersApi";
import { OrderCard } from "./OrderBits";

const SHOWN = 6;

function HistoryGrid({
  params,
  empty,
}: {
  params: { customerId?: string; productId?: string };
  empty: { title: string; text: string };
}) {
  const list = useOrders({ ...params, pageSize: SHOWN });
  if (list.error) return <FormAlert>{errorMessage(list.error)}</FormAlert>;
  if (!list.data) return <Skeleton height={120} />;
  if (list.data.items.length === 0) return <EmptyState title={empty.title} text={empty.text} />;
  return (
    <div className="ogrid stagger">
      {list.data.items.map((o, i) => (
        <OrderCard key={o.id} order={o} index={i} />
      ))}
    </div>
  );
}

/** "الطلبات" of a customer profile (composed into the customers feature by the app layer). */
export function CustomerOrdersSection({ customerId, orderCount }: { customerId: string; orderCount: number }) {
  return (
    <section>
      <div className="shead">
        <div className="shead__t">
          <span className="overline">{orderCount} طلب</span>
          <h2>الطلبات</h2>
        </div>
        <ButtonLink to={`/orders/new?customerId=${customerId}`} variant="ghost" size="sm" icon="plus">
          طلب جديد
        </ButtonLink>
      </div>
      <HistoryGrid
        params={{ customerId }}
        empty={{ title: "لسا ما في طلبات", text: "بتظهر طلبات العميل هون من أول طلب." }}
      />
    </section>
  );
}

/** "حركة البيع" of a product: units sold (delivered orders) and the latest orders that contain it. */
export function ProductOrdersSection({ productId, sold }: { productId: string; sold: number }) {
  return (
    <article className="card">
      <div className="shead">
        <div className="shead__t">
          <span className="overline">انباع منه {sold} قطعة (طلبات توصّلت)</span>
          <h2>طلبات فيها المنتج</h2>
        </div>
        <ButtonLink to={`/orders/new?productId=${productId}`} variant="ghost" size="sm" icon="plus">
          طلب جديد
        </ButtonLink>
      </div>
      <HistoryGrid
        params={{ productId }}
        empty={{ title: "لسا ما انطلب", text: "بتظهر الطلبات اللي فيها المنتج هون." }}
      />
    </article>
  );
}

/** «آخر الطلبات» on the dashboard (prototype shipping labels): the 4 latest orders, newest first. */
export function LatestOrdersGrid() {
  const list = useOrders({ pageSize: 4 });
  if (list.error) return <FormAlert>{errorMessage(list.error)}</FormAlert>;
  if (!list.data) return <Skeleton height={120} />;
  return (
    <div className="ogrid stagger">
      {list.data.items.map((o, i) => (
        <OrderCard key={o.id} order={o} index={i} />
      ))}
    </div>
  );
}
