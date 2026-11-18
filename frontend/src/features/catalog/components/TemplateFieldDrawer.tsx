import { useState } from "react";
import { ApiError, errorMessage } from "@/services/api/apiClient";
import { Button } from "@/shared/ui/Button";
import { Checkbox } from "@/shared/ui/form/Checkbox";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { SelectField } from "@/shared/ui/form/SelectField";
import { TextField } from "@/shared/ui/form/TextField";
import { Drawer } from "@/shared/ui/overlay/Drawer";
import type { TemplateField, TemplateFieldBody, TemplateFieldType } from "../api/catalogTypes";

const TYPE_OPTIONS: { value: TemplateFieldType; label: string }[] = [
  { value: "text", label: "نص" },
  { value: "number", label: "رقم" },
  { value: "select", label: "اختيار من قائمة" },
  { value: "date", label: "تاريخ" },
];

export const fieldTypeLabel = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label])) as Record<TemplateFieldType, string>;

interface TemplateFieldDrawerProps {
  /** null = closed; "new" = add; a field = edit. */
  target: TemplateField | "new" | null;
  templateName: string;
  saving: boolean;
  onClose: () => void;
  onSave: (body: TemplateFieldBody) => Promise<void>;
}

/** Add or edit a custom template field (D-092): label ≤ 40, type, options for select (1–20), required. */
export function TemplateFieldDrawer({ target, templateName, saving, onClose, onSave }: TemplateFieldDrawerProps) {
  return (
    <Drawer open={target !== null} onClose={onClose} title={target === "new" ? `حقل جديد لقالب ${templateName}` : "تعديل الحقل"}>
      {target !== null && <FieldForm key={target === "new" ? "new" : target.key} field={target === "new" ? null : target} saving={saving} onClose={onClose} onSave={onSave} />}
    </Drawer>
  );
}

function FieldForm({ field, saving, onClose, onSave }: { field: TemplateField | null; saving: boolean; onClose: () => void; onSave: (body: TemplateFieldBody) => Promise<void> }) {
  const [label, setLabel] = useState(field?.labelAr ?? "");
  const [type, setType] = useState<TemplateFieldType>(field?.type ?? "text");
  const [options, setOptions] = useState((field?.options ?? []).join("\n"));
  const [required, setRequired] = useState(field?.isRequired ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    const list = options.split(/[\n،,]/).map((o) => o.trim()).filter(Boolean);
    const next: Record<string, string> = {};
    if (!label.trim()) next.labelAr = "اسم الحقل مطلوب.";
    else if (label.trim().length > 40) next.labelAr = "اسم الحقل لازم يكون 40 حرف أو أقل.";
    if (type === "select" && (list.length === 0 || list.length > 20 || new Set(list.map((o) => o.toLowerCase())).size !== list.length)) {
      next.options = "اكتب من 1 لـ 20 خيارات مختلفة، كل خيار بسطر.";
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setFormError(null);
    try {
      await onSave({ labelAr: label.trim(), type, options: type === "select" ? list : [], isRequired: required });
    } catch (error) {
      if (error instanceof ApiError && error.code === "template.duplicate_field_label") {
        setErrors({ labelAr: error.message });
      } else if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        setErrors(Object.fromEntries(Object.entries(error.fieldErrors).map(([k, v]) => [k, v[0] ?? ""])));
      } else {
        setFormError(errorMessage(error));
      }
    }
  };

  return (
    <form
      className="col"
      style={{ gap: 14 }}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {formError && <FormAlert>{formError}</FormAlert>}
      <TextField label="اسم الحقل" required autoFocus maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} error={errors.labelAr} />
      <SelectField label="نوع الحقل" options={TYPE_OPTIONS} value={type} onChange={(e) => setType(e.target.value as TemplateFieldType)} error={errors.type} />
      {type === "select" && (
        <div className="field">
          <label className="field__label" htmlFor="tf-options">
            الخيارات <span className="req">*</span>
          </label>
          <span className={`control control--textarea${errors.options ? " is-error" : ""}`}>
            <textarea id="tf-options" rows={4} value={options} onChange={(e) => setOptions(e.target.value)} placeholder={"خيار بكل سطر"} aria-invalid={errors.options ? true : undefined} />
          </span>
          {errors.options && (
            <span className="field__error" role="alert">
              {errors.options}
            </span>
          )}
        </div>
      )}
      <Checkbox label="حقل مطلوب لكل منتج بهذا القالب" checked={required} onChange={(e) => setRequired(e.target.checked)} />
      <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
        <Button variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
        <Button type="submit" loading={saving}>
          حفظ
        </Button>
      </div>
    </form>
  );
}
