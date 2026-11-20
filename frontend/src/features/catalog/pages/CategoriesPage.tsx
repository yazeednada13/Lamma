import { useState } from "react";
import { Link } from "react-router";
import { errorMessage } from "@/services/api/apiClient";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { Button, IconButton } from "@/shared/ui/Button";
import { useConfirm } from "@/shared/ui/confirm/ConfirmProvider";
import { EmptyState } from "@/shared/ui/feedback/EmptyState";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useCategories, useDeleteCategory, useSaveCategory } from "../api/catalogApi";
import type { Category } from "../api/catalogTypes";
import { CategoryDrawer } from "../components/CategoryDrawer";

/** Categories (prototype `#/categories`): cards with product counts; add, rename, delete (D-095). */
export function CategoriesPage() {
  const categories = useCategories();
  const save = useSaveCategory();
  const remove = useDeleteCategory();
  const toast = useToast();
  const [drawer, setDrawer] = useState<Category | "new" | null>(null);
  const confirm = useConfirm();

  const header = (
    <PageHeader
      title="التصنيفات"
      subtitle="رتّب منتجاتك بمجموعات"
      crumbs={
        <>
          <Link to="/products">المنتجات</Link> / التصنيفات
        </>
      }
      actions={
        <Button icon="plus" onClick={() => setDrawer("new")}>
          تصنيف
        </Button>
      }
    />
  );

  // A blocked delete (category.has_products, with the count) is shown inside the confirmation (D-095).
  const deleteCategory = async (category: Category) => {
    const done = await confirm({
      tone: "danger",
      icon: "trash",
      title: "حذف التصنيف؟",
      subject: category.name,
      message: "المنتجات المؤرشفة بتضل محفوظة باسم التصنيف.",
      confirmLabel: "حذف",
      action: () => remove.mutateAsync(category.id),
    });
    if (done) toast(`انحذف تصنيف «${category.name}»`);
  };

  return (
    <>
      {header}
      {categories.error ? (
        <ErrorState message={errorMessage(categories.error)} onRetry={() => void categories.refetch()} />
      ) : !categories.data ? (
        <PageSkeleton />
      ) : categories.data.length === 0 ? (
        <EmptyState title="ما في تصنيفات لسا" text="التصنيفات بتساعدك تلاقي منتجاتك بسرعة، مثلًا فساتين أو عطور.">
          <Button icon="plus" onClick={() => setDrawer("new")}>
            أضف تصنيف
          </Button>
        </EmptyState>
      ) : (
        <div className="customers-strip stagger">
          {categories.data.map((c, i) => (
            <div key={c.id} className="catcard" style={{ ["--i" as string]: i }}>
              <div className="catcard__stack">
                {Array.from({ length: Math.min(Math.max(c.productCount, 1), 3) }, (_, k) => (
                  <span key={k}>
                    <Illustration kind="product" template="other" />
                  </span>
                ))}
              </div>
              <div className="row">
                <div className="grow">
                  <b style={{ font: "var(--lamma-type-h3)" }}>{c.name}</b>
                  <div className="caption">{c.productCount} منتجات بالنظام</div>
                </div>
                <IconButton icon="pencil" size="sm" label={`تعديل ${c.name}`} onClick={() => setDrawer(c)} />
                <IconButton
                  icon="trash"
                  size="sm"
                  label={`حذف ${c.name}`}
                  onClick={() => void deleteCategory(c)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <CategoryDrawer
        target={drawer}
        saving={save.isPending}
        onClose={() => setDrawer(null)}
        onSave={async (name) => {
          const isNew = drawer === "new";
          await save.mutateAsync({ id: isNew ? undefined : (drawer as Category).id, name });
          setDrawer(null);
          toast(isNew ? `انضاف تصنيف «${name}»` : "انحفظ التصنيف");
        }}
      />
    </>
  );
}
