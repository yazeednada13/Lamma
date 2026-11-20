import { useState } from "react";
import { Link, useParams } from "react-router";
import { channelLabel } from "@/features/settings";
import { errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber, toFils } from "@/shared/lib/money";
import { Button, ButtonLink } from "@/shared/ui/Button";
import { useConfirm } from "@/shared/ui/confirm/ConfirmProvider";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { Icon } from "@/shared/ui/Icon";
import { MetricCard } from "@/shared/ui/MetricCard";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useCustomer, useSetCustomerArchived } from "../api/customersApi";
import type { CustomersSlots } from "../slots";
import { CustomerAvatar, SegmentTags } from "../components/CustomerBits";
import { CustomerFormDrawer } from "../components/CustomerFormDrawer";
import { phoneDisplay, placeLabel } from "../domain/customerDomain";

const date = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { day: "numeric", month: "long", timeZone: "UTC" });

/** Customer profile (prototype `#/customers/:id`). The orders section comes from the orders feature (D-119: no WhatsApp button). */
export function CustomerProfilePage({ ordersSection }: { ordersSection?: CustomersSlots["customerOrders"] }) {
  const { id } = useParams();
  const customer = useCustomer(id);
  const archive = useSetCustomerArchived();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (customer.error) {
    return (
      <>
        <PageHeader crumbs={<Link to="/customers">العملاء</Link>} />
        <ErrorState message={errorMessage(customer.error)} onRetry={() => void customer.refetch()} />
      </>
    );
  }

  const c = customer.data;
  if (!c) return <PageSkeleton />;

  const archiveCustomer = async () => {
    const done = await confirm({
      tone: "warning",
      icon: "archive",
      title: "أرشفة العميل؟",
      subject: c.name,
      message: "رح يختفي من قائمة العملاء، وبيضل محفوظ بسجلاتك وطلباته. بتقدر ترجّعه بأي وقت من «المؤرشفين».",
      confirmLabel: "أرشفة",
      action: () => archive.mutateAsync({ id: c.id, archived: true }),
    });
    if (done) toast(`انأرشف «${c.name}»`);
  };

  const restoreCustomer = async () => {
    setError(null);
    try {
      await archive.mutateAsync({ id: c.id, archived: false });
      toast(`رجع «${c.name}» للعملاء`);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const place = placeLabel(c.city, c.area);
  return (
    <>
      <PageHeader
        crumbs={
          <>
            <Link to="/customers">العملاء</Link> / {c.name}
          </>
        }
      />
      {error && <FormAlert>{error}</FormAlert>}
      <section className="chero">
        <CustomerAvatar name={c.name} percent={Math.min(100, c.orderCount * 5)} />
        <div>
          <span className="overline">من {channelLabel[c.channel]}</span>
          <h1>{c.name}</h1>
          <div className="chero__meta">
            {c.phone && (
              <span>
                <Icon name="phone" size={16} />
                <span className="ltr">{phoneDisplay(c.phone)}</span>
              </span>
            )}
            {place && (
              <span>
                <Icon name="map-pin" size={16} />
                {place}
              </span>
            )}
            <span>
              <Icon name="calendar" size={16} />
              آخر طلب {c.lastOrderOn ? date.format(new Date(`${c.lastOrderOn}T00:00:00Z`)) : "—"}
            </span>
          </div>
          <div className="chero__tags">
            {c.isArchived ? <span className="tag">مؤرشف</span> : <SegmentTags segments={c.segments} />}
          </div>
          {c.notes && <p className="caption" style={{ marginTop: 8 }}>{c.notes}</p>}
        </div>
        <div className="chero__acts">
          {!c.isArchived && (
            <ButtonLink to={`/orders/new?customerId=${c.id}`} icon="plus">
              طلب جديد
            </ButtonLink>
          )}
          <Button variant="outline" icon="pencil" onClick={() => setEditing(true)}>
            تعديل
          </Button>
          {c.isArchived ? (
            <Button variant="secondary" icon="arrow-back-up" loading={archive.isPending} onClick={() => void restoreCustomer()}>
              استرجاع العميل
            </Button>
          ) : (
            <Button variant="ghost" icon="archive" onClick={() => void archiveCustomer()}>
              أرشفة
            </Button>
          )}
        </div>
      </section>
      <div className="grid g-4">
        <MetricCard icon="receipt" tone="olive" label="الطلبات" value={c.orderCount} />
        <MetricCard icon="cash" tone="green" label="مجموع الشراء" value={formatMoneyNumber(c.totalSpent)} unit="د.أ" />
        <MetricCard icon="chart-bar" tone="blue" label="متوسط الطلب" value={formatMoneyNumber(c.averageOrder)} unit="د.أ" />
        <MetricCard
          icon="wallet"
          tone={toFils(c.balanceDue) > 0 ? "brick" : "olive"}
          label="المستحق"
          value={formatMoneyNumber(c.balanceDue)}
          unit="د.أ"
          foot={toFils(c.balanceDue) > 0 ? "من طلبات غير مدفوعة" : "ما عليه إشي"}
        />
      </div>
      {ordersSection?.({ customerId: c.id, orderCount: c.orderCount })}
      <CustomerFormDrawer
        open={editing}
        customer={c}
        onClose={() => setEditing(false)}
        onSaved={() => toast("انحفظ العميل")}
      />
    </>
  );
}
