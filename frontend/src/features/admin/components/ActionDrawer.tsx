import { useState } from "react";
import { errorMessage } from "@/services/api/apiClient";
import { parseMoneyInput } from "@/shared/lib/money";
import { useActionKey } from "@/shared/lib/useActionKey";
import { Button } from "@/shared/ui/Button";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { SelectField } from "@/shared/ui/form/SelectField";
import { TextField } from "@/shared/ui/form/TextField";
import { Drawer } from "@/shared/ui/overlay/Drawer";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useSubscriberAction, type SubscriberAction } from "../api/adminApi";

export type DrawerKind = "extend-trial" | "activate" | "extend" | "suspend" | "notes";

const TITLE: Record<DrawerKind, string> = {
  "extend-trial": "تمديد التجربة",
  activate: "تفعيل خطة",
  extend: "تمديد الخطة",
  suspend: "إيقاف الحساب",
  notes: "ملاحظة جديدة",
};

const DONE: Record<DrawerKind, string> = {
  "extend-trial": "تمدّدت التجربة",
  activate: "تفعّلت الخطة",
  extend: "تمدّدت الخطة",
  suspend: "توقّف الحساب",
  notes: "انحفظت الملاحظة",
};

/** One admin form (D-164): the fields of the chosen action; every change is audited on the server. */
export function ActionDrawer({ kind, businessId, onClose }: { kind: DrawerKind; businessId: string; onClose: () => void }) {
  const toast = useToast();
  const mutation = useSubscriberAction(businessId);
  const key = useActionKey();
  const [days, setDays] = useState("7");
  const [plan, setPlan] = useState<"monthly" | "yearly">("monthly");
  const [startsOn, setStartsOn] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const build = (): SubscriberAction | string => {
    if (kind === "extend-trial" || kind === "extend") {
      const n = Number(days);
      if (!Number.isInteger(n) || n < 1 || n > (kind === "extend" ? 366 : 90)) return `عدد الأيام لازم يكون بين 1 و${kind === "extend" ? 366 : 90}.`;
      return { kind, days: n };
    }

    if (kind === "activate") {
      const money = amount.trim() ? parseMoneyInput(amount) : null;
      if (amount.trim() && money === null) return "المبلغ مش صحيح.";
      return {
        kind,
        plan,
        startsOn: startsOn || undefined,
        amount: money ?? undefined,
        reference: reference.trim() || undefined,
        note: text.trim() || undefined,
      };
    }

    if (!text.trim()) return kind === "suspend" ? "اكتب سبب الإيقاف." : "اكتب الملاحظة.";
    return kind === "suspend" ? { kind, reason: text.trim() } : { kind, text: text.trim() };
  };

  const submit = async () => {
    setError(null);
    const action = build();
    if (typeof action === "string") {
      setError(action);
      return;
    }

    try {
      await mutation.mutateAsync({ action, key: key.keyFor(action) });
      key.done();
      toast(DONE[kind], { type: "success" });
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={TITLE[kind]}
      footer={
        <Button block size="lg" loading={mutation.isPending} variant={kind === "suspend" ? "danger" : "primary"} onClick={() => void submit()}>
          {TITLE[kind]}
        </Button>
      }
    >
      <div className="col" style={{ gap: 14 }}>
        {(kind === "extend-trial" || kind === "extend") && (
          <TextField
            label="عدد الأيام"
            type="number"
            ltr
            min={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            help={kind === "extend-trial" ? "إذا التجربة خلصت، بتنفتح من اليوم" : "بتنضاف بآخر الخطة الشغالة أو الجاية"}
          />
        )}
        {kind === "activate" && (
          <>
            <SelectField
              label="الخطة"
              value={plan}
              onChange={(e) => setPlan(e.target.value as "monthly" | "yearly")}
              options={[
                { value: "monthly", label: "شهرية (9 د.أ)" },
                { value: "yearly", label: "سنوية (90 د.أ)" },
              ]}
            />
            <TextField label="تبدأ من" type="date" ltr value={startsOn} onChange={(e) => setStartsOn(e.target.value)} help="فاضي = بعد التجربة أو الخطة الشغالة، أو اليوم" />
            <TextField label="المبلغ المدفوع" ltr inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} help="فاضي = سعر الخطة" affix="د.أ" />
            <TextField label="مرجع التحويل" value={reference} onChange={(e) => setReference(e.target.value)} />
          </>
        )}
        {(kind === "suspend" || kind === "notes" || kind === "activate") && (
          <div className="field">
            <label className="field__label" htmlFor="admin-text">
              {kind === "suspend" ? "سبب الإيقاف" : kind === "notes" ? "الملاحظة" : "ملاحظة (اختياري)"}
            </label>
            <span className="control control--textarea">
              <textarea id="admin-text" rows={3} maxLength={kind === "notes" ? 1000 : 300} value={text} onChange={(e) => setText(e.target.value)} />
            </span>
          </div>
        )}
        {error && <FormAlert>{error}</FormAlert>}
      </div>
    </Drawer>
  );
}
