import { useState } from "react";
import { SettingsGroup, type SettingsExtraSection } from "@/features/settings";
import { errorMessage } from "@/services/api/apiClient";
import { Button, IconButton } from "@/shared/ui/Button";
import { useConfirm } from "@/shared/ui/confirm/ConfirmProvider";
import { Skeleton } from "@/shared/ui/feedback/Skeleton";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { TextField } from "@/shared/ui/form/TextField";
import { Icon } from "@/shared/ui/Icon";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import {
  useCourier,
  useCreateCategory,
  useExpenseCategories,
  useRenameCategory,
  useSaveCourierName,
  useSetCategoryArchived,
  type ExpenseCategory,
} from "../api/financeApi";
import { categoryIcon } from "../domain/financeDomain";

/** Settings → «تصنيفات المصاريف» (prototype `sexp`, D-142): add, rename, archive and restore; «توصيل» is locked. */
function ExpenseCategoriesSection() {
  const categories = useExpenseCategories(true);
  const create = useCreateCategory();
  const rename = useRenameCategory();
  const setArchived = useSetCategoryArchived();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<{ id: string | null; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!editing) return;
    setError(null);
    try {
      if (editing.id) await rename.mutateAsync({ id: editing.id, name: editing.name });
      else await create.mutateAsync(editing.name);
      toast(editing.id ? "انحفظ اسم التصنيف" : `انضاف تصنيف «${editing.name.trim()}»`);
      setEditing(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const archive = async (c: ExpenseCategory) => {
    const done = await confirm({
      tone: "warning",
      icon: "archive",
      title: "أرشفة التصنيف؟",
      subject: c.name,
      message: "ما رح يظهر لما تسجّل مصروف جديد، ومصاريفه القديمة بتضل محسوبة. بتقدر ترجّعه بأي وقت.",
      confirmLabel: "أرشفة",
      action: () => setArchived.mutateAsync({ id: c.id, archived: true }),
    });
    if (done) toast(`انأرشف «${c.name}»`);
  };

  const active = categories.data?.filter((c) => !c.isArchived) ?? [];
  const archived = categories.data?.filter((c) => c.isArchived) ?? [];
  return (
    <SettingsGroup
      id="sexp"
      icon="wallet"
      tone="tone-brick"
      title="تصنيفات المصاريف"
      subtitle="بتساعدك تشوف وين بتروح مصاريك"
    >
      {error && <FormAlert>{error}</FormAlert>}
      {categories.error ? (
        <FormAlert>{errorMessage(categories.error)}</FormAlert>
      ) : !categories.data ? (
        <Skeleton height={60} />
      ) : (
        <>
          <div className="row wrap" style={{ gap: 6 }}>
            {active.map((c) => (
              <span key={c.id} className="chip" style={{ gap: 6 }}>
                <Icon name={categoryIcon(c.code)} size={16} /> {c.name}
                {c.isSystem ? (
                  <span title="ثابت: فروقات تسوية شركة التوصيل بتنسجّل عليه" aria-label="تصنيف ثابت">
                    <Icon name="lock" size={16} />
                  </span>
                ) : (
                  <>
                    <IconButton
                      icon="pencil"
                      size="sm"
                      label={`تعديل ${c.name}`}
                      onClick={() => setEditing({ id: c.id, name: c.name })}
                    />
                    <IconButton icon="archive" size="sm" label={`أرشفة ${c.name}`} onClick={() => void archive(c)} />
                  </>
                )}
              </span>
            ))}
            <button type="button" className="chip" onClick={() => setEditing({ id: null, name: "" })}>
              <Icon name="plus" size={16} /> تصنيف
            </button>
          </div>
          {editing && (
            <form
              className="row wrap"
              style={{ gap: 8, marginTop: 12, alignItems: "flex-end" }}
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <TextField
                label={editing.id ? "الاسم الجديد" : "اسم التصنيف"}
                autoFocus
                maxLength={40}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
              <Button
                type="submit"
                size="sm"
                loading={create.isPending || rename.isPending}
                disabled={!editing.name.trim()}
              >
                حفظ
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                إلغاء
              </Button>
            </form>
          )}
          {archived.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <span className="caption">المؤرشفة</span>
              <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                {archived.map((c) => (
                  <span key={c.id} className="chip" style={{ gap: 6, opacity: 0.7 }}>
                    {c.name}
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="arrow-back-up"
                      onClick={() =>
                        void setArchived.mutateAsync({ id: c.id, archived: false }).then(() => toast(`رجع «${c.name}»`))
                      }
                    >
                      استرجاع
                    </Button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </SettingsGroup>
  );
}

/** Settings → «شركة التوصيل» (D-139): the company's display name. */
function CourierSettingsSection() {
  const courier = useCourier();
  const save = useSaveCourierName();
  const toast = useToast();
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const value = name ?? courier.data?.companyName ?? "";

  return (
    <SettingsGroup
      id="scourier"
      icon="truck"
      tone="tone-blue"
      title="شركة التوصيل"
      subtitle="اللي بتجمع «عند الاستلام» وبتحوّلك"
    >
      {error && <FormAlert>{error}</FormAlert>}
      {!courier.data ? (
        <Skeleton height={44} />
      ) : (
        <form
          className="row wrap"
          style={{ gap: 8, alignItems: "flex-end" }}
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            save.mutateAsync(value).then(
              () => {
                setName(null);
                toast("انحفظ اسم شركة التوصيل");
              },
              (err: unknown) => setError(errorMessage(err)),
            );
          }}
        >
          <TextField
            label="اسم الشركة"
            icon="truck"
            maxLength={60}
            value={value}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            loading={save.isPending}
            disabled={!value.trim() || value.trim() === courier.data.companyName}
          >
            حفظ
          </Button>
        </form>
      )}
    </SettingsGroup>
  );
}

export const expenseCategoriesSettingsSection: SettingsExtraSection = {
  id: "sexp",
  icon: "wallet",
  label: "المصاريف",
  element: <ExpenseCategoriesSection />,
};

export const courierSettingsSection: SettingsExtraSection = {
  id: "scourier",
  icon: "truck",
  label: "شركة التوصيل",
  element: <CourierSettingsSection />,
};
