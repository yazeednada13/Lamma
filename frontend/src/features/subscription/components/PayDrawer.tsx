import { useState } from "react";
import { errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber } from "@/shared/lib/money";
import { useActionKey } from "@/shared/lib/useActionKey";
import { Button } from "@/shared/ui/Button";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { Icon } from "@/shared/ui/Icon";
import { Drawer } from "@/shared/ui/overlay/Drawer";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { usePayment, type Subscription } from "../api/subscriptionApi";
import { PLAN_LABEL, type PaidPlan } from "../domain/subscriptionDomain";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

/** One CliQ detail with a copy button. */
function CopyRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="row between" style={{ gap: 10, padding: "12px 14px", borderRadius: 14, background: "var(--lamma-olive-50)" }}>
      <span>
        <span className="caption">{label}</span>
        <br />
        <b className="ltr" style={{ font: "var(--lamma-type-number-md)" }}>
          {value}
        </b>
      </span>
      <Button size="sm" variant="outline" icon="check" onClick={onCopy}>
        انسخ
      </Button>
    </div>
  );
}

/** «ادفع بكليك» (D-163, D-178, D-179): the CliQ details with copy buttons, then the proof upload. */
export function PayDrawer({ open, onClose, plan, data }: { open: boolean; onClose: () => void; plan: PaidPlan; data: Subscription }) {
  const toast = useToast();
  const pay = usePayment();
  const action = useActionKey();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const price = data.plans.find((p) => p.plan === plan)?.price ?? "0";

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`انتسخ ${what}`, { type: "success" });
    } catch {
      toast("ما قدرنا ننسخ، انسخه يدويًا", { type: "error" });
    }
  };

  const pick = (f: File | null) => {
    setError(null);
    if (f && !ACCEPT.split(",").includes(f.type)) {
      setError("الملف لازم يكون صورة (JPG أو PNG أو WEBP) أو PDF.");
      return;
    }

    if (f && f.size > MAX_BYTES) {
      setError("حجم الملف لازم يكون 5 ميجا أو أقل.");
      return;
    }

    setFile(f);
  };

  const submit = async () => {
    if (!file) {
      setError("ارفع صورة التحويل أول.");
      return;
    }

    try {
      await pay.mutateAsync({ plan, file, key: action.keyFor({ plan, name: file.name, size: file.size }) });
      action.done();
      toast("وصلتنا صورة التحويل، وبنفعّل خطتك أول ما نتأكد منها", { type: "success" });
      setFile(null);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`ادفع بكليك: ${PLAN_LABEL[plan]}`}
      footer={
        <Button block size="lg" loading={pay.isPending} onClick={() => void submit()}>
          ابعت صورة التحويل
        </Button>
      }
    >
      <div className="col" style={{ gap: 14 }}>
        <ol className="col" style={{ gap: 8, margin: 0, paddingInlineStart: 20, font: "var(--lamma-type-body)" }}>
          <li>افتح تطبيق البنك واختار التحويل بكليك.</li>
          <li>حوّل المبلغ لهالاسم، واكتب الرقم المرجعي بملاحظة التحويل.</li>
          <li>صوّر شاشة التحويل الناجح وارفعها هون.</li>
        </ol>
        <CopyRow label="اسم كليك (Alias)" value={data.cliqAlias} onCopy={() => void copy(data.cliqAlias, "اسم كليك")} />
        <CopyRow label="اسم صاحب الحساب" value={data.cliqName} onCopy={() => void copy(data.cliqName, "الاسم")} />
        <CopyRow label="المبلغ (د.أ)" value={formatMoneyNumber(price)} onCopy={() => void copy(formatMoneyNumber(price), "المبلغ")} />
        <CopyRow label="الرقم المرجعي (اكتبه بالملاحظة)" value={data.referenceCode} onCopy={() => void copy(data.referenceCode, "الرقم المرجعي")} />

        <label
          className="card"
          style={{ display: "grid", placeItems: "center", gap: 8, padding: 18, borderStyle: "dashed", cursor: "pointer", textAlign: "center" }}
        >
          <Icon name="upload" size={24} />
          <b>{file ? file.name : "ارفع صورة التحويل"}</b>
          <span className="caption">صورة (JPG أو PNG أو WEBP) أو PDF، لحد 5 ميجا</span>
          <input type="file" accept={ACCEPT} hidden onChange={(e) => pick(e.target.files?.[0] ?? null)} aria-label="صورة التحويل" />
        </label>
        {error && <FormAlert>{error}</FormAlert>}
      </div>
    </Drawer>
  );
}
