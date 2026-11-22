import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { placeLabel } from "@/features/customers";
import { checkAmount, defaultMethod, recordableMethods } from "@/features/payments";
import { formatMoneyNumber } from "@/shared/lib/money";
import {
  PAYMENT_METHODS,
  SALES_CHANNELS,
  usePaymentMethodSettings,
  useSalesChannelSettings,
} from "@/features/settings";
import { errorMessage } from "@/services/api/apiClient";
import { parseMoneyInput } from "@/shared/lib/money";
import { Button } from "@/shared/ui/Button";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import {
  fetchProductWithVariants,
  useCreateOrder,
  useCustomerOption,
  useOrder,
  useProductsWithVariants,
  useProductWithVariants,
  useUpdateOrder,
  type CustomerOption,
  type OrderDetails,
} from "../api/ordersApi";
import { OrderCustomerSection } from "../components/OrderCustomerSection";
import { OrderDeliverySection, OrderPaymentSection } from "../components/OrderExtrasSections";
import { OrderLinesSection } from "../components/OrderLinesSection";
import { OrderReceipt } from "../components/OrderReceipt";
import { businessDate, computeReceipt } from "../domain/orderDomain";
import { depositShortcut } from "../domain/returnModel";
import {
  emptyOrderForm,
  formFromOrder,
  lineFrom,
  linePrice,
  lineVariant,
  orderBody,
  type Line,
  type OrderFormState,
} from "../domain/orderFormModel";

/** New order (prototype `#/orders/new`, 4 steps + live receipt) and full edit of a «جديد» order (D-127). */
export function OrderFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  return id ? (
    <EditOrderLoader id={id} />
  ) : (
    <NewOrderLoader
      customerId={params.get("customerId")}
      productId={params.get("productId")}
      preOrder={params.has("preorder")}
    />
  );
}

/** `?customerId=` and `?productId=` preselect from the customer profile or the product page. */
function NewOrderLoader({
  customerId,
  productId,
  preOrder,
}: {
  customerId: string | null;
  productId: string | null;
  preOrder: boolean;
}) {
  const product = useProductWithVariants(productId);
  if (productId && product.isPending) return <PageSkeleton />;
  const preset = product.data && !product.data.isArchived ? lineFrom(product.data, []) : null;
  return <OrderForm initial={{ ...emptyOrderForm(customerId, preset ? [preset] : []), isPreOrder: preOrder }} />;
}

function EditOrderLoader({ id }: { id: string }) {
  const order = useOrder(id);
  const products = useProductsWithVariants([...new Set(order.data?.items.map((i) => i.productId) ?? [])]);
  const error = order.error ?? products.find((p) => p.error)?.error;
  if (error) return <ErrorState message={errorMessage(error)} onRetry={() => void order.refetch()} />;
  if (!order.data || products.some((p) => !p.data)) return <PageSkeleton />;

  const o = order.data;
  if (!o.canEditItems) {
    return (
      <>
        <PageHeader crumbs={<Link to={`/orders/${o.id}`}>#{o.number}</Link>} />
        <FormAlert tone="info">
          المنتجات بتنعدّل بس والطلب «جديد». من صفحة الطلب بتقدر تعدّل العنوان والهدية والملاحظة.
        </FormAlert>
      </>
    );
  }

  return (
    <OrderForm key={o.id} editing={o} initial={formFromOrder(o, new Map(products.map((p) => [p.data!.id, p.data!])))} />
  );
}

const STEPS: { id: string; label: string; icon: IconName }[] = [
  { id: "s1", label: "العميل", icon: "users" },
  { id: "s2", label: "المنتجات", icon: "package" },
  { id: "s3", label: "التوصيل", icon: "truck" },
  { id: "s4", label: "الدفع", icon: "cash" },
];

function OrderForm({ initial, editing }: { initial: OrderFormState; editing?: OrderDetails }) {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const create = useCreateOrder();
  const update = useUpdateOrder();
  const channelSettings = useSalesChannelSettings();
  const methodSettings = usePaymentMethodSettings();
  const [form, setForm] = useState<OrderFormState>(initial);
  const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const customer = useCustomerOption(form.customerId);

  const set = (patch: Partial<OrderFormState>) => setForm((f) => ({ ...f, ...patch }));
  const channels = SALES_CHANNELS.filter(
    (c) => channelSettings.data?.channels.some((r) => r.channel === c && r.isEnabled) || c === form.channel,
  );
  const methods = PAYMENT_METHODS.filter(
    (m) => methodSettings.data?.methods.some((r) => r.method === m && r.isEnabled) || m === form.paymentMethod,
  );
  const c = customer.data;
  const channel = form.channel ?? (c && channels.includes(c.channel) ? c.channel : (channels[0] ?? null));

  const fee = parseMoneyInput(form.fee);
  const discount = parseMoneyInput(form.discount);
  const receipt = computeReceipt(
    form.lines.map((l) => ({ quantity: l.quantity, unitPrice: linePrice(l), unitCost: lineVariant(l).cost })),
    fee ?? "0",
    discount ?? "0",
  );
  const overStock = form.lines.some((l) => l.quantity > lineVariant(l).available);
  // D-151: a pre-order may exceed stock when saved «جديد»; «مؤكد» still reserves, so it needs the stock.
  const today = businessDate(new Date());
  const preOrderError =
    form.isPreOrder &&
    (!form.expectedOn || (form.expectedOn < today && form.expectedOn !== editing?.expectedDeliveryOn))
      ? "اختار تاريخ اليوم أو بعده."
      : undefined;
  const giftMissing = form.isGift && !form.recipientName.trim();
  // D-135: an optional deposit with a new order, ≤ the total, with a recordable method (never COD, D-138).
  const depositMethods = recordableMethods(methodSettings.data?.methods);
  const depositMethod = form.depositMethod ?? defaultMethod(depositMethods, form.paymentMethod);
  const depositCheck = !editing && form.depositAmount.trim() ? checkAmount(form.depositAmount, receipt.total) : null;
  const depositInvalid = depositCheck !== null && (depositCheck.amount === null || depositMethod === null);
  const done = [
    Boolean(c && !c.isArchived),
    form.lines.length > 0 && (!overStock || form.isPreOrder),
    fee !== null && discount !== null && !receipt.discountTooHigh && !giftMissing && !preOrderError,
    Boolean(channel) && !depositInvalid,
  ];
  const ready = done.every(Boolean);

  const chooseCustomer = (x: CustomerOption) =>
    set({
      customerId: x.id,
      channel: channels.includes(x.channel) ? x.channel : form.channel,
      address: form.address || placeLabel(x.city, x.area),
    });

  const addProduct = async (productId: string) => {
    setError(null);
    setLoadingProductId(productId);
    try {
      const product = await fetchProductWithVariants(queryClient, productId);
      const line = lineFrom(
        product,
        form.lines.map((l) => l.variantId),
        form.isPreOrder,
      );
      if (line) setForm((f) => ({ ...f, lines: [...f.lines, line] }));
      else toast(`كل نسخ «${product.name}» المتوفرة مضافة أو خلصت`, { type: "info" });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingProductId(null);
    }
  };

  const changeLine = (key: string, patch: Partial<Line>) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));

  const save = async (status: "new" | "confirmed") => {
    if (!ready || !channel) return;
    setError(null);
    try {
      if (editing) {
        const order = await update.mutateAsync({ id: editing.id, body: orderBody(form, channel) });
        toast(`انحفظت تعديلات الطلب #${order.number}`);
        navigate(`/orders/${order.id}`);
      } else {
        const payment =
          depositCheck?.amount && depositMethod ? { amount: depositCheck.amount, method: depositMethod } : undefined;
        const order = await create.mutateAsync({
          ...orderBody(form, channel),
          customerId: form.customerId!,
          status,
          payment,
        });
        toast(
          status === "confirmed"
            ? `انحفظ الطلب #${order.number} وانحجزت القطع، كل شي بمكانه`
            : `انحفظ الطلب #${order.number}`,
        );
        navigate(`/orders/${order.id}`, { replace: true });
      }
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const saving = create.isPending || update.isPending;
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <>
      <PageHeader
        title={editing ? `تعديل الطلب #${editing.number}` : "طلب جديد"}
        subtitle={
          editing
            ? "الطلب لسا «جديد»، فبتقدر تغيّر المنتجات والكميات"
            : "من رسالة واتساب أو إنستغرام… لطلب مرتب بأربع خطوات"
        }
        crumbs={
          <>
            <Link to="/orders">الطلبات</Link> /{" "}
            {editing ? <Link to={`/orders/${editing.id}`}>#{editing.number}</Link> : "طلب جديد"}
          </>
        }
      />
      <nav className="steps2" aria-label="خطوات الطلب">
        <span className="steps2__line" />
        <span
          className="steps2__fill"
          style={{ ["--p" as string]: Math.max(0, (done.filter(Boolean).length - 1) / 3) }}
        />
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`step2${done[i] ? " is-done" : done.slice(0, i).every(Boolean) ? " is-now" : ""}`}
            onClick={() =>
              document.getElementById(s.id)?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth" })
            }
          >
            <span>
              <Icon name={s.icon} />
            </span>
            {s.label}
          </button>
        ))}
      </nav>
      {error && <FormAlert>{error}</FormAlert>}
      <div className="grid g-main" style={{ gap: 20 }}>
        <div className="col" style={{ gap: 16 }}>
          <OrderCustomerSection
            done={done[0]!}
            customer={form.customerId ? customer : null}
            locked={Boolean(editing)}
            channels={channels}
            channel={channel}
            onChoose={chooseCustomer}
            onClear={() => set({ customerId: null })}
            onChannel={(ch) => set({ channel: ch })}
          />
          <OrderLinesSection
            done={done[1]!}
            lines={form.lines}
            loadingProductId={loadingProductId}
            onAdd={(id) => void addProduct(id)}
            onChange={changeLine}
            onRemove={(key) => setForm((f) => ({ ...f, lines: f.lines.filter((l) => l.key !== key) }))}
            preOrder={form.isPreOrder}
          />
          <OrderDeliverySection
            done={done[2]!}
            form={form}
            set={set}
            feeInvalid={fee === null}
            discountInvalid={discount === null}
            discountTooHigh={receipt.discountTooHigh}
            preOrderMin={editing ? undefined : today}
            preOrderError={preOrderError}
          />
          <OrderPaymentSection
            done={done[3]!}
            form={form}
            set={set}
            methods={methods}
            deposit={
              editing
                ? undefined
                : {
                    methods: depositMethods,
                    method: depositMethod,
                    error: depositCheck?.error,
                    help: depositCheck?.help || undefined,
                    shortcut: formatMoneyNumber(depositShortcut(receipt.total)).replace(/,/g, ""),
                  }
            }
          />
        </div>
        <aside className="receipt-wrap">
          <OrderReceipt
            customerName={c?.name ?? null}
            channel={channel}
            caption={editing ? `#${editing.number}` : "اليوم"}
            lines={form.lines}
            fee={fee ?? "0"}
            discount={discount ?? "0"}
            receipt={receipt}
            paidNow={depositCheck?.amount ?? null}
          />
          <div className="col" style={{ gap: 8 }}>
            {editing ? (
              <Button size="lg" icon="check" loading={saving} disabled={!ready} onClick={() => void save("new")}>
                حفظ التعديلات
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  icon="check"
                  loading={saving && create.variables?.status === "confirmed"}
                  disabled={!ready || saving || overStock}
                  onClick={() => void save("confirmed")}
                >
                  حفظ كـ «مؤكد»
                </Button>
                <Button
                  variant="outline"
                  loading={saving && create.variables?.status === "new"}
                  disabled={!ready || saving}
                  onClick={() => void save("new")}
                >
                  حفظ كـ «جديد»
                </Button>
              </>
            )}
            <p className="caption">«مؤكد» بيحجز القطع تلقائيًا. بتنخصم من المخزون لما يصير «تم التوصيل».</p>
          </div>
        </aside>
      </div>
    </>
  );
}
