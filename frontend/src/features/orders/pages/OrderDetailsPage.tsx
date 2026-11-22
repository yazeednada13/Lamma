import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { phoneDisplay, placeLabel } from "@/features/customers";
import { OrderPaymentCard } from "@/features/payments";
import { errorMessage } from "@/services/api/apiClient";
import { toFils } from "@/shared/lib/money";
import { Button, ButtonLink } from "@/shared/ui/Button";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Icon } from "@/shared/ui/Icon";
import { Menu } from "@/shared/ui/Menu";
import { Money } from "@/shared/ui/Money";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useOrder } from "../api/ordersApi";
import { OrderDetailsDrawer } from "../components/OrderDetailsDrawer";
import { OrderHero } from "../components/OrderHero";
import { OrderTimeline } from "../components/OrderTimeline";
import { ReturnDrawer } from "../components/ReturnDrawer";
import { Initials, ItemThumb } from "../components/OrderBits";
import { useCancelOrder } from "../components/useCancelOrder";
import { useOrderMove } from "../components/useOrderMove";
import { STATUS } from "../domain/orderDomain";

/** Order details (prototype `#/orders/:id`): label hero with lifecycle, items and receipt, thread, undo, edit, cancel. */
export function OrderDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const order = useOrder(id);
  const toast = useToast();
  const { move, undoChange, movingId, undoing } = useOrderMove();
  const cancel = useCancelOrder();
  const [editingDetails, setEditingDetails] = useState(false);
  const [returning, setReturning] = useState(false);

  if (order.error) {
    return (
      <>
        <PageHeader crumbs={<Link to="/orders">الطلبات</Link>} />
        <ErrorState message={errorMessage(order.error)} onRetry={() => void order.refetch()} />
      </>
    );
  }

  const o = order.data;
  if (!o) return <PageSkeleton />;

  const next = o.nextStatus;
  const menuItems = [
    ...(o.canEditItems
      ? [
          {
            label: "تعديل الطلب",
            icon: "pencil" as const,
            danger: false,
            onSelect: () => navigate(`/orders/${o.id}/edit`),
          },
        ]
      : []),
    ...(o.canEditDetails
      ? [
          {
            label: "تفاصيل التوصيل والهدية",
            icon: "map-pin" as const,
            danger: false,
            onSelect: () => setEditingDetails(true),
          },
        ]
      : []),
    // Skipping steps (D-121): every allowed forward status other than the usual next one and cancel.
    ...o.allowedStatuses
      .filter((s) => s !== o.nextStatus && s !== "cancelled")
      .map((s) => ({
        label: `نقل مباشرة لـ «${STATUS[s].label}»`,
        icon: STATUS[s].icon,
        danger: false,
        onSelect: () => void move(o, s),
      })),
    ...(o.canReturn
      ? [{ label: "إرجاع", icon: "arrow-back-up" as const, danger: false, onSelect: () => setReturning(true) }]
      : []),
    ...(o.allowedStatuses.includes("cancelled")
      ? [
          {
            label: "إلغاء الطلب",
            icon: "x" as const,
            danger: true,
            // D-137: a paid order is cancelled only after its payments are reversed (refunds come with returns).
            onSelect: () =>
              toFils(o.paid) > 0
                ? toast("على الطلب دفعات. ألغِ الدفعات من بطاقة «الدفع» أول، بعدين ألغِ الطلب.", { type: "error" })
                : void cancel(o),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        crumbs={
          <>
            <Link to="/orders">الطلبات</Link> / <span className="ltr">#{o.number}</span>
          </>
        }
        actions={
          <>
            {o.undo && (
              <Button
                variant="outline"
                icon="arrow-back-up"
                loading={undoing}
                onClick={() => void undoChange(o)}
                title="بترجع الحالة اللي قبل خلال 5 دقايق من التغيير"
              >
                تراجع عن «{STATUS[o.undo.from].label}»
              </Button>
            )}
            {menuItems.length > 0 && (
              <Menu
                label="المزيد"
                trigger={(props) => (
                  <button type="button" className="btn btn--outline icon-btn" aria-label="المزيد" {...props}>
                    <Icon name="dots-vertical" />
                  </button>
                )}
              >
                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    className={`menu__item${item.danger ? " menu__item--danger" : ""}`}
                    onClick={item.onSelect}
                  >
                    <Icon name={item.icon} /> {item.label}
                  </button>
                ))}
              </Menu>
            )}
            {next && (
              <Button icon={STATUS[next].icon} loading={movingId === o.id} onClick={() => void move(o, next)}>
                نقل لـ «{STATUS[next].label}»
              </Button>
            )}
          </>
        }
      />
      <OrderHero order={o} />
      <div className="grid g-main" style={{ gap: 20 }}>
        <div className="col" style={{ gap: 16 }}>
          <article className="card">
            <div className="shead">
              <div className="shead__t">
                <span className="overline">{o.items.length} منتجات</span>
                <h2>محتوى الطرد</h2>
              </div>
            </div>
            {o.items.map((item) => (
              <Link
                key={item.id}
                className="line2"
                to={`/products/${item.productId}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  gridTemplateColumns: "56px minmax(0,1fr) auto auto",
                }}
              >
                <span className="line2__art">
                  <ItemThumb imageUrl={item.imageUrl} size={56} />
                </span>
                <span>
                  <b>{item.productName}</b>
                  <br />
                  <span className="caption">{item.variantLabel ?? "—"}</span>
                </span>
                <span className="caption">
                  × {item.quantity} · <Money value={item.unitPrice} />
                  {item.returnedQuantity > 0 && (
                    <span style={{ display: "block", color: "var(--lamma-brick-700)" }}>
                      رجع {item.returnedQuantity}
                    </span>
                  )}
                </span>
                <Money value={item.lineTotal} />
              </Link>
            ))}
            <div className="receipt__row" style={{ borderTop: "1.5px dashed #E4E2D3", marginTop: 6, paddingTop: 12 }}>
              <span>المنتجات</span>
              <Money value={o.itemsSubtotal} />
            </div>
            <div className="receipt__row">
              <span>التوصيل</span>
              <Money value={o.deliveryFee} />
            </div>
            {toFils(o.discount) > 0 && (
              <div className="receipt__row">
                <span>خصم</span>
                <Money value={`-${o.discount}`} />
              </div>
            )}
            <div className="receipt__total">
              <b>المجموع</b>
              <Money value={o.total} />
            </div>
            {toFils(o.returnedAmount) > 0 && (
              <>
                <div className="receipt__row">
                  <span>مرتجع{o.isPartiallyReturned ? " جزئي" : ""}</span>
                  <Money value={`-${o.returnedAmount}`} />
                </div>
                <div className="receipt__row">
                  <b>الصافي</b>
                  <Money value={o.netTotal} />
                </div>
              </>
            )}
            <div className="receipt__profit">
              <span>
                <Icon name="wallet" size={16} /> ربحك من الطلب
              </span>
              <b>
                <Money value={o.profit} />
              </b>
            </div>
            <p className="caption" style={{ marginTop: 6 }}>
              الربح = المنتجات − الخصم − تكلفة القطع (<bdi>{o.itemsCost}</bdi> د.أ). رسوم التوصيل محسوبة لحالها.
            </p>
          </article>
          {o.isGift && (
            <div className="giftcard">
              <span className="overline" style={{ color: "var(--lamma-brick-700)" }}>
                <Icon name="gift" size={16} /> هدية {o.recipientName ? `لـ ${o.recipientName}` : ""}
              </span>
              {o.giftMessage && <q>{o.giftMessage}</q>}
              {o.recipientPhone && (
                <span className="caption ltr" style={{ display: "block" }}>
                  {phoneDisplay(o.recipientPhone)}
                </span>
              )}
            </div>
          )}
          <OrderTimeline order={o} />
        </div>
        <div className="col" style={{ gap: 16 }}>
          <OrderPaymentCard order={o} />
          <article className="card">
            <div className="shead">
              <div className="shead__t">
                <span className="overline">التوصيل</span>
                <h2>{o.deliveryAddress ?? "بدون عنوان"}</h2>
              </div>
              {o.canEditDetails && (
                <Button variant="ghost" size="sm" icon="pencil" onClick={() => setEditingDetails(true)}>
                  تعديل
                </Button>
              )}
            </div>
            {o.note ? <p>{o.note}</p> : <p className="caption">ما في ملاحظة على الطلب.</p>}
          </article>
          <article className="card">
            <div className="shead">
              <div className="shead__t">
                <span className="overline">العميل</span>
                <h2>
                  <Link to={`/customers/${o.customer.id}`} style={{ color: "inherit" }}>
                    {o.customer.name}
                  </Link>
                </h2>
              </div>
              <Initials name={o.customer.name} />
            </div>
            <dl className="dl">
              <dt>الهاتف</dt>
              <dd className="ltr">{o.customer.phone ? phoneDisplay(o.customer.phone) : "—"}</dd>
              <dt>المنطقة</dt>
              <dd>{placeLabel(o.customer.city, o.customer.area) || "—"}</dd>
            </dl>
            <ButtonLink
              to={`/orders/new?customerId=${o.customer.id}`}
              variant="outline"
              size="sm"
              icon="plus"
              style={{ marginTop: 12 }}
            >
              طلب جديد لنفس العميل
            </ButtonLink>
          </article>
        </div>
      </div>
      {returning && <ReturnDrawer order={o} open={returning} onClose={() => setReturning(false)} />}
      <OrderDetailsDrawer
        order={o}
        open={editingDetails}
        onClose={() => setEditingDetails(false)}
        onSaved={() => toast("انحفظت تفاصيل الطلب")}
      />
    </>
  );
}
