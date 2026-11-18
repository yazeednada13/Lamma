import { useState } from "react";
import { ApiError, errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber, parseMoneyInput } from "@/shared/lib/money";
import { Button } from "@/shared/ui/Button";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { MoneyField } from "@/shared/ui/form/MoneyField";
import { TextField } from "@/shared/ui/form/TextField";
import { Drawer } from "@/shared/ui/overlay/Drawer";
import type { ProductVariant } from "../api/catalogTypes";

interface VariantEditDrawerProps {
  variant: ProductVariant | null;
  supportsExpiry: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (body: { priceOverride: string | null; costOverride: string | null; expiryDate: string | null }) => Promise<void>;
}

const plain = (money: string | null) => (money ? formatMoneyNumber(money).replace(/,/g, "") : "");

/** Edit one variant's own price, cost (empty = the product's) and expiry. Stock is changed in Phase 3 screens. */
export function VariantEditDrawer({ variant, supportsExpiry, saving, onClose, onSave }: VariantEditDrawerProps) {
  return (
    <Drawer open={variant !== null} onClose={onClose} title={variant ? `النسخة ${variant.label}` : ""}>
      {variant && <VariantEditForm key={variant.id} variant={variant} supportsExpiry={supportsExpiry} saving={saving} onClose={onClose} onSave={onSave} />}
    </Drawer>
  );
}

function VariantEditForm({ variant, supportsExpiry, saving, onClose, onSave }: Omit<VariantEditDrawerProps, "variant"> & { variant: ProductVariant }) {
  const [price, setPrice] = useState(plain(variant.priceOverride));
  const [cost, setCost] = useState(plain(variant.costOverride));
  const [expiry, setExpiry] = useState(variant.expiryDate ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    const next: Record<string, string> = {};
    const priceValue = price.trim() ? parseMoneyInput(price) : null;
    const costValue = cost.trim() ? parseMoneyInput(cost) : null;
    if (price.trim() && (priceValue === null || Number(priceValue) <= 0)) next.priceOverride = "اكتب سعر أكبر من صفر، بخانتين عشريتين كحد أقصى.";
    if (cost.trim() && costValue === null) next.costOverride = "اكتب تكلفة صحيحة، بخانتين عشريتين كحد أقصى.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setFormError(null);
    try {
      await onSave({ priceOverride: priceValue, costOverride: costValue, expiryDate: supportsExpiry && expiry ? expiry : null });
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        setErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k, v[0] ?? ""])));
      } else {
        setFormError(errorMessage(error));
      }
    }
  };

  return (
    <div className="col" style={{ gap: 14 }}>
      {formError && <FormAlert>{formError}</FormAlert>}
      <MoneyField label="سعر خاص لهذه النسخة" help="فاضي = سعر المنتج" value={price} onChange={(e) => setPrice(e.target.value)} error={errors.priceOverride} />
      <MoneyField label="تكلفة خاصة لهذه النسخة" help="فاضي = تكلفة المنتج" value={cost} onChange={(e) => setCost(e.target.value)} error={errors.costOverride} />
      {supportsExpiry && <TextField label="تاريخ الانتهاء" type="date" ltr value={expiry} onChange={(e) => setExpiry(e.target.value)} error={errors.expiryDate} />}
      <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
        <Button variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
        <Button loading={saving} onClick={() => void submit()}>
          حفظ
        </Button>
      </div>
    </div>
  );
}
