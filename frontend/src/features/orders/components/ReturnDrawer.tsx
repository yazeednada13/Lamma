import { useState } from "react";
import { checkAmount, defaultMethod, recordableMethods } from "@/features/payments";
import { paymentMethodLabel, usePaymentMethodSettings, type PaymentMethodCode } from "@/features/settings";
import { errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber, toFils } from "@/shared/lib/money";
import { Button } from "@/shared/ui/Button";
import { useConfirm } from "@/shared/ui/confirm/ConfirmProvider";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { MoneyField } from "@/shared/ui/form/MoneyField";
import { TextField } from "@/shared/ui/form/TextField";
import { Money } from "@/shared/ui/Money";
import { Drawer } from "@/shared/ui/overlay/Drawer";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useReturnOrder, type OrderDetails } from "../api/ordersApi";
import { businessDate } from "../domain/orderDomain";
import { returnable, returnPreview } from "../domain/returnModel";
import { ItemThumb } from "./OrderBits";

const plain = (amount: string) => formatMoneyNumber(amount).replace(/,/g, "");

/**
 * «إرجاع الطلب» (prototype `App.returnOrder`, D-145–D-150): per line the pieces returned and whether they go back to
 * stock or are damaged; the refund is prefilled with the minimum that leaves no customer credit. Final, so it confirms.
 */
export function ReturnDrawer({ order, open, onClose }: { order: OrderDetails; open: boolean; onClose: () => void }) {
  return (
    <Drawer open={open} title={`إرجاع الطلب #${order.number}`} onClose={onClose}>
      <ReturnForm order={order} onClose={onClose} />
    </Drawer>
  );
}

function ReturnForm({ order, onClose }: { order: OrderDetails; onClose: () => void }) {
  const save = useReturnOrder();
  const settings = usePaymentMethodSettings();
  const confirm = useConfirm();
  const toast = useToast();
  const items = order.items.filter((i) => returnable(i) > 0);
  const today = businessDate(new Date());
  const deliveredOn = order.deliveredAt ? businessDate(new Date(order.deliveredAt)) : today;

  const [picks, setPicks] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, returnable(i)])),
  );
  const [restock, setRestock] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.id, true])),
  );
  const [refundText, setRefundText] = useState<string | null>(null); // null = follow the minimum
  const [chosen, setChosen] = useState<PaymentMethodCode | null>(null);
  const [returnedOn, setReturnedOn] = useState(today);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const picked = items.filter((i) => (picks[i.id] ?? 0) > 0);
  const preview = returnPreview(order, picks);
  const refundInput = refundText ?? plain(preview.minRefund);
  const maxFils = toFils(preview.maxRefund);
  const minFils = toFils(preview.minRefund);
  const refundCheck = maxFils > 0 ? checkAmount(refundInput || "0", preview.maxRefund) : null;
  const refund = refundInput.trim() === "" || refundInput.trim() === "0" ? "0.000" : (refundCheck?.amount ?? null);
  const refundError =
    maxFils === 0
      ? undefined
      : refund === null || toFils(refund) < minFils
        ? `المبلغ المسترد لازم يكون بين ${formatMoneyNumber(preview.minRefund)} و ${formatMoneyNumber(preview.maxRefund)} د.أ`
        : undefined;
  const methods = recordableMethods(settings.data?.methods);
  const method = chosen ?? defaultMethod(methods, order.paymentMethod);
  const needsMethod = refund !== null && toFils(refund) > 0;
  const dateError =
    !returnedOn || returnedOn > today || returnedOn < deliveredOn
      ? "التاريخ لازم يكون بين يوم التوصيل واليوم."
      : undefined;
  const canSave =
    picked.length > 0 && !refundError && !dateError && (!needsMethod || method !== null) && !save.isPending;

  const submit = async () => {
    if (!canSave) return;
    setError(null);
    const full = items.every((i) => (picks[i.id] ?? 0) === returnable(i));
    const pieces = picked.reduce((n, i) => n + (picks[i.id] ?? 0), 0);
    const done = await confirm({
      tone: "danger",
      icon: "arrow-back-up",
      title: "تأكيد الإرجاع؟",
      subject: `${pieces} قطعة · ${formatMoneyNumber(preview.value)} د.أ`,
      message: `المرتجع نهائي وما بينلغى.${needsMethod ? ` رح ينسجّل استرداد ${formatMoneyNumber(refund!)} د.أ للزبون.` : ""}`,
      confirmLabel: "تأكيد الإرجاع",
      cancelLabel: "رجوع",
      action: () =>
        save.mutateAsync({
          id: order.id,
          body: {
            lines: picked.map((i) => ({ orderItemId: i.id, quantity: picks[i.id]!, restock: restock[i.id] ?? true })),
            returnedOn,
            reason: reason.trim() || null,
            refund: needsMethod && method ? { amount: refund!, method } : null,
          },
        }),
    });
    if (done) {
      toast(full ? `انرجع الطلب #${order.number} كامل` : `انسجّل المرتجع (${pieces} قطعة)`);
      onClose();
    } else if (save.error) {
      setError(errorMessage(save.error));
    }
  };

  return (
    <div className="col" style={{ gap: 14 }}>
      <p className="muted">
        القطع اللي بترجع للمخزون بتنضاف للمتوفر، والتالفة ما بترجع. قيمة المرتجع بتنطرح من المبيعات.
      </p>
      {error && <FormAlert>{error}</FormAlert>}
      {items.map((i) => {
        const max = returnable(i);
        const qty = picks[i.id] ?? 0;
        return (
          <div key={i.id} className="line2" style={{ gridTemplateColumns: "48px minmax(0,1fr) auto" }}>
            <span className="line2__art">
              <ItemThumb imageUrl={i.imageUrl} size={48} />
            </span>
            <span className="col" style={{ gap: 6, minWidth: 0 }}>
              <b>{i.productName}</b>
              <span className="caption">
                {i.variantLabel ?? "—"} · بيترجّع لحد {max}
              </span>
              <span className="row wrap" style={{ gap: 6 }} role="radiogroup" aria-label={`حالة ${i.productName}`}>
                {[true, false].map((back) => (
                  <button
                    key={String(back)}
                    type="button"
                    role="radio"
                    aria-checked={(restock[i.id] ?? true) === back}
                    className={`chip${(restock[i.id] ?? true) === back ? " is-selected" : ""}`}
                    disabled={qty === 0}
                    onClick={() => setRestock((r) => ({ ...r, [i.id]: back }))}
                  >
                    {back ? "رجعت للمخزون" : "تالفة"}
                  </button>
                ))}
              </span>
            </span>
            <span className="stepper">
              <button
                type="button"
                aria-label={`زيادة ${i.productName}`}
                disabled={qty >= max}
                onClick={() => setPicks((p) => ({ ...p, [i.id]: qty + 1 }))}
              >
                +
              </button>
              <input className="ltr" value={qty} aria-label={`كمية مرتجع ${i.productName}`} readOnly />
              <button
                type="button"
                aria-label={`نقص ${i.productName}`}
                disabled={qty <= 0}
                onClick={() => setPicks((p) => ({ ...p, [i.id]: qty - 1 }))}
              >
                −
              </button>
            </span>
          </div>
        );
      })}
      <div className="receipt__row">
        <span>قيمة المرتجع</span>
        <Money value={preview.value} />
      </div>
      <div className="receipt__row">
        <span>الطلب بيصير</span>
        <Money value={preview.netAfter} />
      </div>
      {maxFils === 0 ? (
        <p className="caption">الزبون ما دفع شي على الطلب، فالمبلغ بينطرح من المستحق عليه بدون استرداد.</p>
      ) : (
        <>
          <MoneyField
            label="المبلغ المسترد"
            value={refundInput}
            onChange={(e) => setRefundText(e.target.value)}
            error={refundError}
            help={
              minFils === maxFils
                ? "لازم يرجع هالمبلغ حتى ما يضل الزبون دافع أكثر من الطلب"
                : `بين ${formatMoneyNumber(preview.minRefund)} و ${formatMoneyNumber(preview.maxRefund)} د.أ`
            }
          />
          {needsMethod && (
            <div className="field">
              <span className="field__label">طريقة الاسترداد</span>
              <div className="row wrap" style={{ gap: 6 }} role="radiogroup" aria-label="طريقة الاسترداد">
                {methods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={method === m}
                    className={`chip${method === m ? " is-selected" : ""}`}
                    onClick={() => setChosen(m)}
                  >
                    {paymentMethodLabel[m]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <TextField
        label="تاريخ المرتجع"
        icon="calendar"
        type="date"
        ltr
        value={returnedOn}
        min={deliveredOn}
        max={today}
        onChange={(e) => setReturnedOn(e.target.value)}
        error={dateError}
      />
      <TextField
        label="السبب"
        maxLength={200}
        placeholder="مثلًا: المقاس مش مناسب"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="row wrap" style={{ gap: 8, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={onClose}>
          إلغاء
        </Button>
        <Button
          icon="arrow-back-up"
          variant="danger"
          loading={save.isPending}
          disabled={!canSave}
          onClick={() => void submit()}
        >
          تأكيد الإرجاع
        </Button>
      </div>
    </div>
  );
}
