import { useState } from "react";
import { errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber, parseMoneyInput, toFils } from "@/shared/lib/money";
import { Button } from "@/shared/ui/Button";
import { Chip } from "@/shared/ui/Chip";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { MoneyField } from "@/shared/ui/form/MoneyField";
import { TextField } from "@/shared/ui/form/TextField";
import { Icon } from "@/shared/ui/Icon";
import { Drawer } from "@/shared/ui/overlay/Drawer";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useExpenseCategories, useRecordExpense, useVoidExpense, type Expense } from "../api/financeApi";
import { businessToday, categoryIcon } from "../domain/financeDomain";

const UNDO_TOAST_MS = 10_000;

/**
 * «مصروف جديد» drawer (prototype `App.addExpense`): amount, category chips with the last used one preselected, date
 * (back-dating allowed, D-143) and a note. The toast's «تراجع» voids it. Keep it mounted with its page.
 */
export function AddExpenseDrawer({
  open,
  onClose,
  lastCategoryId,
}: {
  open: boolean;
  onClose: () => void;
  lastCategoryId: string | null;
}) {
  const voidExpense = useVoidExpense();
  const toast = useToast();

  const undo = async (expense: Expense) => {
    try {
      await voidExpense.mutateAsync({ id: expense.id, reason: "تراجع بعد التسجيل" });
      toast("انلغى المصروف", { type: "info" });
    } catch (error) {
      toast(errorMessage(error), { type: "error" });
    }
  };

  return (
    <Drawer open={open} title="مصروف جديد" onClose={onClose}>
      <ExpenseForm
        lastCategoryId={lastCategoryId}
        onClose={onClose}
        onSaved={(e) => {
          toast(`انسجّل مصروف ${e.categoryName} ${formatMoneyNumber(e.amount)} د.أ`, {
            action: "تراجع",
            onAction: () => void undo(e),
            durationMs: UNDO_TOAST_MS,
          });
          onClose();
        }}
      />
    </Drawer>
  );
}

function ExpenseForm({
  lastCategoryId,
  onClose,
  onSaved,
}: {
  lastCategoryId: string | null;
  onClose: () => void;
  onSaved: (e: Expense) => void;
}) {
  const categories = useExpenseCategories();
  const record = useRecordExpense();
  const today = businessToday();
  const [amountText, setAmountText] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [spentOn, setSpentOn] = useState(today);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = categories.data ?? [];
  const categoryId = chosen ?? (list.some((c) => c.id === lastCategoryId) ? lastCategoryId : (list[0]?.id ?? null));
  const amount = parseMoneyInput(amountText);
  const amountError =
    amount === null || toFils(amount) <= 0 ? "اكتب مبلغ أكبر من صفر، بمنزلتين عشريتين بالأكثر." : undefined;
  const dateError = !spentOn || spentOn > today ? "التاريخ ما بصير يكون بالمستقبل." : undefined;

  const save = async () => {
    setTouched(true);
    if (amountError || dateError || !amount || !categoryId) return;
    setError(null);
    try {
      onSaved(await record.mutateAsync({ amount, categoryId, spentOn, note: note.trim() || null }));
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
      {categories.error && <FormAlert>{errorMessage(categories.error)}</FormAlert>}
      <MoneyField
        label="المبلغ"
        required
        autoFocus
        placeholder="0.00"
        value={amountText}
        onChange={(e) => setAmountText(e.target.value)}
        error={touched ? amountError : undefined}
      />
      <div className="field">
        <span className="field__label">التصنيف</span>
        <div className="row wrap" style={{ gap: 6 }} role="radiogroup" aria-label="التصنيف">
          {list.map((c) => (
            <Chip
              key={c.id}
              selected={categoryId === c.id}
              role="radio"
              aria-checked={categoryId === c.id}
              onClick={() => setChosen(c.id)}
            >
              <Icon name={categoryIcon(c.code)} size={16} /> {c.name}
            </Chip>
          ))}
        </div>
        <span className="field__help">آخر تصنيف استخدمته مختار تلقائي</span>
      </div>
      <TextField
        label="التاريخ"
        icon="calendar"
        type="date"
        ltr
        value={spentOn}
        max={today}
        onChange={(e) => setSpentOn(e.target.value)}
        error={dateError}
      />
      <TextField
        label="ملاحظة"
        maxLength={200}
        placeholder="مثلًا: ترويج ريلز"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="row wrap" style={{ gap: 8, justifyContent: "flex-end" }}>
        <Button variant="ghost" onClick={onClose}>
          إلغاء
        </Button>
        <Button type="submit" icon="check" loading={record.isPending} disabled={!categoryId || record.isPending}>
          حفظ
        </Button>
      </div>
    </form>
  );
}
