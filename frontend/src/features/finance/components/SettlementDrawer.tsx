import { useState } from "react";
import { errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber, toFils } from "@/shared/lib/money";
import { Button } from "@/shared/ui/Button";
import { Checkbox } from "@/shared/ui/form/Checkbox";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { MoneyField } from "@/shared/ui/form/MoneyField";
import { TextField } from "@/shared/ui/form/TextField";
import { Icon } from "@/shared/ui/Icon";
import { Money } from "@/shared/ui/Money";
import { Drawer } from "@/shared/ui/overlay/Drawer";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useSettle, type HeldOrder } from "../api/financeApi";
import { businessToday, settlementPreview } from "../domain/financeDomain";

const plain = (amount: string) => formatMoneyNumber(amount).replace(/,/g, "");

/**
 * «تسجيل تحويل من شركة التوصيل» (prototype `App.settle`, D-141): pick the orders (all by default), the amount that
 * arrived (prefilled with expected) and the date. Any difference is booked automatically as a «توصيل» expense (D-035).
 */
export function SettlementDrawer({
  open,
  onClose,
  orders,
  companyName,
}: {
  open: boolean;
  onClose: () => void;
  orders: HeldOrder[];
  companyName: string;
}) {
  return (
    <Drawer open={open} title={`تسجيل تحويل من ${companyName}`} onClose={onClose}>
      <SettlementForm orders={orders} onClose={onClose} />
    </Drawer>
  );
}

function SettlementForm({ orders, onClose }: { orders: HeldOrder[]; onClose: () => void }) {
  const settle = useSettle();
  const toast = useToast();
  const today = businessToday();
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(orders.map((o) => o.orderId)));
  const [receivedText, setReceivedText] = useState<string | null>(null); // null = follow the expected amount
  const [settledOn, setSettledOn] = useState(today);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const chosen = orders.filter((o) => picked.has(o.orderId));
  const expectedOnly = settlementPreview(
    chosen.map((o) => o.remaining),
    "0",
  ).expected;
  const input = receivedText ?? plain(expectedOnly);
  const preview = settlementPreview(
    chosen.map((o) => o.remaining),
    input,
  );
  const dateError = !settledOn || settledOn > today ? "التاريخ ما بصير يكون بالمستقبل." : undefined;
  const canSave = preview.received !== null && !dateError && !settle.isPending;

  const toggle = (id: string) =>
    setPicked((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    if (!preview.received || dateError) return;
    setError(null);
    try {
      const result = await settle.mutateAsync({
        orderIds: chosen.map((o) => o.orderId),
        receivedAmount: preview.received,
        settledOn,
        note: note.trim() || null,
      });
      toast(
        `تمت التسوية: ${result.orders.length} طلبات صارت «مدفوع»${toFils(result.difference) > 0 ? ` وانسجّل فرق ${formatMoneyNumber(result.difference)} د.أ مصروف توصيل` : ""}`,
      );
      onClose();
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
      {error && <FormAlert>{error}</FormAlert>}
      <MoneyField
        label="المبلغ اللي وصلك"
        value={input}
        onChange={(e) => setReceivedText(e.target.value)}
        error={chosen.length > 0 ? preview.error : undefined}
        help={`المتوقع ${formatMoneyNumber(preview.expected)} د.أ`}
      />
      <div className="field">
        <span className="field__label">الطلبات المشمولة</span>
        <div className="col" style={{ gap: 6 }}>
          {orders.map((o) => (
            <Checkbox
              key={o.orderId}
              checked={picked.has(o.orderId)}
              onChange={() => toggle(o.orderId)}
              label={
                <>
                  <span className="ltr">#{o.number}</span> · {o.customerName} · <Money value={o.remaining} />
                </>
              }
            />
          ))}
        </div>
        {chosen.length === 0 && <span className="field__error">اختار طلب واحد على الأقل.</span>}
      </div>
      {preview.received !== null && toFils(preview.difference) > 0 && (
        <div className="attention" role="status" style={{ padding: "10px 12px" }}>
          <Icon name="alert-triangle" />
          <span>
            المتوقع <Money value={preview.expected} />، في فرق <Money value={preview.difference} />. بينسجّل تلقائي
            مصروف «توصيل» (رسوم الشركة).
          </span>
        </div>
      )}
      <TextField
        label="تاريخ التحويل"
        icon="calendar"
        type="date"
        ltr
        value={settledOn}
        max={today}
        onChange={(e) => setSettledOn(e.target.value)}
        error={dateError}
      />
      <TextField
        label="ملاحظة"
        maxLength={200}
        placeholder="مثلًا: تحويل CliQ"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="row wrap" style={{ gap: 8, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={onClose}>
          إلغاء
        </Button>
        <Button type="submit" icon="check" loading={settle.isPending} disabled={!canSave}>
          تأكيد التسوية
        </Button>
      </div>
    </form>
  );
}
