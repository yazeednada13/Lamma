import { useState } from "react";
import { ApiError, errorMessage } from "@/services/api/apiClient";
import { Button } from "@/shared/ui/Button";
import { Chip } from "@/shared/ui/Chip";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { SelectField } from "@/shared/ui/form/SelectField";
import { TextField } from "@/shared/ui/form/TextField";
import { Icon } from "@/shared/ui/Icon";
import { Dialog } from "@/shared/ui/overlay/Dialog";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useAdjustStock, type AdjustmentReason } from "../api/inventoryApi";
import { adjustPreview, reasonLabel, reasonsFor } from "../domain/inventoryDomain";

export interface AdjustableVariant {
  variantId: string;
  label: string;
  onHand: number;
  reserved: number;
}

interface AdjustStockDialogProps {
  open: boolean;
  productName: string;
  variants: readonly AdjustableVariant[];
  onClose: () => void;
  /** Lets the caller refresh its own data (e.g. the catalog product). */
  onDone?: () => void;
}

/** Stock adjustment with a reason (prototype `App.adjustStock`, D-110). Idempotent submit (D-112). */
export function AdjustStockDialog({ open, productName, variants, onClose, onDone }: AdjustStockDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="تعديل المخزون">
      {open && <AdjustForm productName={productName} variants={variants} onClose={onClose} onDone={onDone} />}
    </Dialog>
  );
}

function AdjustForm({ productName, variants, onClose, onDone }: Omit<AdjustStockDialogProps, "open">) {
  const adjust = useAdjustStock();
  const toast = useToast();
  const [variantId, setVariantId] = useState(variants[0]?.variantId ?? "");
  const [increase, setIncrease] = useState(false);
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState<AdjustmentReason>("damage");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const variant = variants.find((v) => v.variantId === variantId) ?? variants[0];
  if (!variant) return null;
  const delta = increase ? amount : -amount;
  const preview = adjustPreview(variant.onHand, variant.reserved, delta);
  const allowed = reasonsFor(increase);
  const chosen = allowed.some((r) => r.code === reason) ? reason : allowed[0]!.code;

  const submit = async () => {
    setError(null);
    try {
      const result = await adjust.mutateAsync({ variantId: variant.variantId, delta, reason: chosen, note: note.trim() || null });
      toast(`انعدّل مخزون «${productName}» من ${variant.onHand} لـ ${result.onHand}`);
      onDone?.();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : errorMessage(e));
    }
  };

  return (
    <div className="col" style={{ gap: 14 }}>
      <p className="caption">
        {productName} · موجود {variant.onHand} · محجوز {variant.reserved}
      </p>
      {variants.length > 1 && (
        <SelectField label="النسخة" options={variants.map((v) => ({ value: v.variantId, label: `${v.label} (${v.onHand})` }))} value={variant.variantId} onChange={(e) => setVariantId(e.target.value)} />
      )}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="segmented" role="group" aria-label="نوع التعديل">
          <button type="button" className={!increase ? "is-active" : undefined} aria-pressed={!increase} onClick={() => setIncrease(false)}>
            نقص −
          </button>
          <button type="button" className={increase ? "is-active" : undefined} aria-pressed={increase} onClick={() => setIncrease(true)}>
            زيادة +
          </button>
        </div>
        <span className="stepper">
          <button type="button" aria-label="زيادة" onClick={() => setAmount((n) => Math.min(n + 1, 100_000))}>
            +
          </button>
          <input className="ltr" aria-label="الكمية" inputMode="numeric" value={amount} onChange={(e) => setAmount(Math.max(1, Math.min(100_000, Number.parseInt(e.target.value, 10) || 1)))} />
          <button type="button" aria-label="نقص" onClick={() => setAmount((n) => Math.max(1, n - 1))}>
            −
          </button>
        </span>
      </div>
      <div className="field">
        <span className="field__label">
          السبب <span className="req">*</span>
        </span>
        <div className="row wrap" role="group" aria-label="السبب">
          {allowed.map((r) => (
            <Chip key={r.code} selected={chosen === r.code} onClick={() => setReason(r.code)}>
              {r.label}
            </Chip>
          ))}
        </div>
      </div>
      <TextField label="ملاحظة" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} help={`السبب: ${reasonLabel(chosen)}`} />
      <div className="adjprev" aria-live="polite">
        <span className="num">{variant.onHand}</span>
        <Icon name="arrow-left" />
        <span className={`to num${delta < 0 ? " is-down" : ""}`}>{preview.after}</span>
      </div>
      {preview.belowReserved && (
        <div className="field__error" role="alert">
          <Icon name="alert-triangle" size={16} /> {variant.reserved > 0 ? `ما بنقدر ننزل تحت المحجوز (${variant.reserved} قطع لطلبات مؤكدة)` : "ما بنقدر ننقص أكثر من الموجود"}
        </div>
      )}
      {error && <FormAlert>{error}</FormAlert>}
      <div className="dialog__actions">
        <Button variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
        <Button loading={adjust.isPending} disabled={preview.belowReserved} onClick={() => void submit()}>
          تأكيد
        </Button>
      </div>
    </div>
  );
}
