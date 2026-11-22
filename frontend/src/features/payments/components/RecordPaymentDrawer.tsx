import { useState } from "react";
import { paymentMethodLabel, usePaymentMethodSettings, type PaymentMethodCode } from "@/features/settings";
import { errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber, type MoneyString } from "@/shared/lib/money";
import { Button } from "@/shared/ui/Button";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { MoneyField } from "@/shared/ui/form/MoneyField";
import { TextField } from "@/shared/ui/form/TextField";
import { Icon } from "@/shared/ui/Icon";
import { Money } from "@/shared/ui/Money";
import { Drawer } from "@/shared/ui/overlay/Drawer";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import {
  useReceivables,
  useRecordCustomerPayment,
  useRecordOrderPayment,
  useReversePayment,
  type PaymentResult,
  type PaymentStatus,
} from "../api/paymentsApi";
import {
  ageLabel,
  amountInput,
  bucketInfo,
  businessToday,
  checkAmount,
  defaultMethod,
  recordableMethods,
} from "../domain/paymentDomain";
import { PaymentBadge } from "./PaymentBadge";

/** What the drawer records against: one order, a customer (FIFO, D-131), or a receivable picked inside the drawer. */
export type PaymentTarget =
  | {
      kind: "order";
      orderId: string;
      number: number;
      customerName: string;
      remaining: MoneyString;
      paymentStatus: PaymentStatus | null;
      expectedMethod?: PaymentMethodCode | null;
      /** The order's creation time (UTC): payments cannot be dated before it (D-136). */
      createdAt?: string;
    }
  | { kind: "customer"; customerId: string; customerName: string; balance: MoneyString }
  | { kind: "pick" };

/** How long «تراجع» stays in the toast (the reversal itself is allowed any time, D-136). */
const UNDO_TOAST_MS = 10_000;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

/**
 * Record-payment drawer (prototype `App.recordPayment`): amount prefilled with what is due, method chips (enabled,
 * never COD), date (today, back-dating allowed) and a note. The success toast offers «تراجع» (a reversal, D-136).
 * Keep it mounted with the page: the toast's undo uses its mutation after the drawer closes.
 */
export function RecordPaymentDrawer({
  open,
  target,
  onClose,
  onDone,
}: {
  open: boolean;
  target: PaymentTarget | null;
  onClose: () => void;
  onDone?: (result: PaymentResult) => void;
}) {
  const reverse = useReversePayment();
  const toast = useToast();

  const undo = async (result: PaymentResult) => {
    try {
      await reverse.mutateAsync({ id: result.payment.id, reason: "تراجع بعد التسجيل" });
      toast("انلغت الدفعة ورجع المبلغ مستحق", { type: "info" });
    } catch (error) {
      toast(errorMessage(error), { type: "error" });
    }
  };

  const saved = (result: PaymentResult) => {
    const first = result.orders[0];
    const amount = formatMoneyNumber(result.payment.amount);
    const message =
      result.payment.orderId === null
        ? `انسجّلت ${amount} د.أ على ${result.orders.length === 1 ? `الطلب #${first?.number}` : `${result.orders.length} طلبات`}`
        : first?.paymentStatus === "paid"
          ? `انسجّلت الدفعة وصار الطلب #${first.number} «مدفوع»`
          : `انسجّلت ${amount} د.أ، بيضل ${formatMoneyNumber(first?.remaining ?? "0")} د.أ`;
    toast(message, { action: "تراجع", onAction: () => void undo(result), durationMs: UNDO_TOAST_MS });
    onDone?.(result);
    onClose();
  };

  return (
    <Drawer open={open && target !== null} title="تسجيل دفعة" onClose={onClose}>
      {target && <PaymentDrawerBody initial={target} onSaved={saved} onClose={onClose} />}
    </Drawer>
  );
}

function PaymentDrawerBody({
  initial,
  onSaved,
  onClose,
}: {
  initial: PaymentTarget;
  onSaved: (r: PaymentResult) => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<PaymentTarget>(initial);
  if (target.kind === "pick") {
    return <ReceivablePicker onPick={(t) => setTarget(t)} onClose={onClose} />;
  }

  return (
    <PaymentForm
      target={target}
      onSaved={onSaved}
      onClose={onClose}
      onBack={initial.kind === "pick" ? () => setTarget(initial) : undefined}
    />
  );
}

/** Pick mode (global «دفعة»): search the receivables, oldest first, and choose one. */
function ReceivablePicker({ onPick, onClose }: { onPick: (t: PaymentTarget) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const list = useReceivables({ search: search.trim() || undefined, pageSize: 8 });
  const items = list.data?.items ?? [];
  return (
    <>
      <TextField
        label="مين بدّه يدفع؟"
        icon="search"
        placeholder="اسم العميل، رقمه أو رقم الطلب"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      {list.error && <FormAlert>{errorMessage(list.error)}</FormAlert>}
      {list.data && items.length === 0 && (
        <p className="muted" style={{ marginTop: 12 }}>
          {search.trim() ? "ما لقينا ذمة بهالبحث." : "ما في ذمم مستحقة، كل شي مدفوع."}
        </p>
      )}
      <div className="col" style={{ gap: 8, marginTop: 12 }}>
        {items.map((r) => (
          <button
            key={r.orderId}
            type="button"
            className="selcust"
            style={{ textAlign: "start", width: "100%", cursor: "pointer" }}
            onClick={() =>
              onPick({
                kind: "order",
                orderId: r.orderId,
                number: r.number,
                customerName: r.customerName,
                remaining: r.remaining,
                paymentStatus: r.paymentStatus,
              })
            }
          >
            <span className="avatar">{initials(r.customerName)}</span>
            <span className="grow">
              <b>{r.customerName}</b>
              <span className="caption" style={{ display: "block" }}>
                <span className="ltr">#{r.number}</span> · المتبقي <Money value={r.remaining} />
              </span>
            </span>
            <span className={`age ${bucketInfo(r.bucket).ageClass}`}>
              <Icon name="clock" size={16} /> {ageLabel(r.ageDays)}
            </span>
          </button>
        ))}
      </div>
      <div className="row" style={{ gap: 8, marginTop: 16 }}>
        <Button variant="ghost" onClick={onClose}>
          إلغاء
        </Button>
      </div>
    </>
  );
}

function PaymentForm({
  target,
  onSaved,
  onClose,
  onBack,
}: {
  target: Exclude<PaymentTarget, { kind: "pick" }>;
  onSaved: (r: PaymentResult) => void;
  onClose: () => void;
  onBack?: () => void;
}) {
  const settings = usePaymentMethodSettings();
  const payOrder = useRecordOrderPayment();
  const payCustomer = useRecordCustomerPayment();
  const max = target.kind === "order" ? target.remaining : target.balance;
  const methods = recordableMethods(settings.data?.methods);
  const today = businessToday();
  const minDate = target.kind === "order" && target.createdAt ? businessToday(new Date(target.createdAt)) : undefined;

  const [amountText, setAmountText] = useState(amountInput(max));
  const [chosen, setChosen] = useState<PaymentMethodCode | null>(null);
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const method = chosen ?? defaultMethod(methods, target.kind === "order" ? target.expectedMethod : null);
  const check = checkAmount(amountText, max);
  const dateError =
    !paidOn || paidOn > today
      ? "التاريخ ما بصير يكون بالمستقبل."
      : minDate && paidOn < minDate
        ? "التاريخ قبل يوم إنشاء الطلب."
        : undefined;
  const saving = payOrder.isPending || payCustomer.isPending;
  const canSave = check.amount !== null && method !== null && !dateError && !saving;

  const save = async () => {
    if (!check.amount || !method || dateError) return;
    setError(null);
    const body = { amount: check.amount, method, paidOn, note: note.trim() || null };
    try {
      onSaved(
        target.kind === "order"
          ? await payOrder.mutateAsync({ orderId: target.orderId, body })
          : await payCustomer.mutateAsync({ customerId: target.customerId, body }),
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <form
      className="col"
      style={{ gap: 14 }}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="selcust">
        <span className="avatar avatar--lg">{initials(target.customerName)}</span>
        <div className="grow">
          <b>{target.customerName}</b>
          <div className="caption">
            {target.kind === "order" ? (
              <>
                <span className="ltr">#{target.number}</span> · المتبقي <Money value={target.remaining} />
              </>
            ) : (
              <>
                المستحق عليه <Money value={target.balance} /> · بتتوزع على أقدم الطلبات أول
              </>
            )}
          </div>
        </div>
        {target.kind === "order" && <PaymentBadge status={target.paymentStatus} />}
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      <MoneyField
        label="المبلغ"
        value={amountText}
        onChange={(e) => setAmountText(e.target.value)}
        error={amountText.trim() ? check.error : "اكتب المبلغ."}
        help={check.help || "افتراضيًا: المبلغ المتبقي كامل"}
      />
      <div className="field">
        <span className="field__label">طريقة الدفع</span>
        {methods.length === 0 ? (
          <span className="field__error">ما في طريقة دفع مفعّلة غير «عند الاستلام». فعّل وحدة من الإعدادات.</span>
        ) : (
          <div className="row wrap" style={{ gap: 6 }} role="radiogroup" aria-label="طريقة الدفع">
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
        )}
        <span className="field__help">«عند الاستلام» بيجمعه المندوب وبينسجّل مع تسوية شركة التوصيل.</span>
      </div>
      <TextField
        label="التاريخ"
        icon="calendar"
        type="date"
        ltr
        value={paidOn}
        max={today}
        min={minDate}
        onChange={(e) => setPaidOn(e.target.value)}
        error={dateError}
      />
      <TextField
        label="ملاحظة"
        maxLength={200}
        placeholder="مثلًا: حوّلت على CliQ"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="row wrap" style={{ gap: 8, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={onClose}>
          إلغاء
        </Button>
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            اختيار ثاني
          </Button>
        )}
        <Button type="submit" icon="check" loading={saving} disabled={!canSave}>
          حفظ الدفعة
        </Button>
      </div>
    </form>
  );
}
