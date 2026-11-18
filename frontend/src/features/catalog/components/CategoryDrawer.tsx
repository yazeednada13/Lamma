import { useState } from "react";
import { ApiError, errorMessage } from "@/services/api/apiClient";
import { Button } from "@/shared/ui/Button";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { TextField } from "@/shared/ui/form/TextField";
import { Drawer } from "@/shared/ui/overlay/Drawer";
import type { Category } from "../api/catalogTypes";

interface CategoryDrawerProps {
  /** null = closed; "new" = create; a category = rename. */
  target: Category | "new" | null;
  saving: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

/** Create or rename a category (name ≤ 60, unique among active categories). */
export function CategoryDrawer({ target, saving, onClose, onSave }: CategoryDrawerProps) {
  return (
    <Drawer open={target !== null} onClose={onClose} title={target === "new" ? "تصنيف جديد" : "تعديل التصنيف"}>
      {target !== null && <CategoryForm key={target === "new" ? "new" : target.id} initial={target === "new" ? "" : target.name} saving={saving} onClose={onClose} onSave={onSave} />}
    </Drawer>
  );
}

function CategoryForm({ initial, saving, onClose, onSave }: { initial: string; saving: boolean; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError("اسم التصنيف مطلوب.");
    if (trimmed.length > 60) return setError("اسم التصنيف لازم يكون 60 حرف أو أقل.");
    setError(undefined);
    setFormError(null);
    try {
      await onSave(trimmed);
    } catch (e) {
      if (e instanceof ApiError && (e.code === "category.duplicate_name" || e.fieldError("name"))) {
        setError(e.fieldError("name") ?? e.message);
      } else {
        setFormError(errorMessage(e));
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
      <TextField label="اسم التصنيف" required autoFocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} error={error} />
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
