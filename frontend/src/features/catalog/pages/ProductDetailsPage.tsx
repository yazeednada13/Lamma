import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { AdjustStockDialog } from "@/features/inventory";
import { errorMessage } from "@/services/api/apiClient";
import { Button, ButtonLink } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/feedback/EmptyState";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { catalogKeys, useProduct, useProductTemplates, useSetProductArchived, useSetVariantArchived, useUpdateVariant } from "../api/catalogApi";
import type { ProductVariant } from "../api/catalogTypes";
import { MovementsCard } from "../components/MovementsCard";
import { ProductHero } from "../components/ProductHero";
import { VariantEditDrawer } from "../components/VariantEditDrawer";
import { VariantsCard } from "../components/VariantsCard";
import { VariantStockMap } from "../components/VariantStockMap";

/** Product details (prototype `#/products/:id`). Stock changes and orders arrive in Phases 3 and 5. */
export function ProductDetailsPage() {
  const { id } = useParams();
  const product = useProduct(id);
  const templates = useProductTemplates();
  const archive = useSetProductArchived();
  const archiveVariant = useSetVariantArchived();
  const updateVariant = useUpdateVariant();
  const toast = useToast();
  const [editing, setEditing] = useState<ProductVariant | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const queryClient = useQueryClient();

  if (product.error) {
    return (
      <>
        <PageHeader crumbs={<Link to="/products">المنتجات</Link>} />
        <ErrorState message={errorMessage(product.error)} onRetry={() => void product.refetch()} />
      </>
    );
  }

  const data = product.data;
  if (!data) {
    return <PageSkeleton />;
  }

  const template = templates.data?.find((t) => t.code === data.templateCode);
  const run = async (action: () => Promise<unknown>, done: string) => {
    setActionError(null);
    try {
      await action();
      toast(done);
    } catch (error) {
      setActionError(errorMessage(error));
    }
  };

  return (
    <>
      <PageHeader
        crumbs={
          <>
            <Link to="/products">المنتجات</Link> / {data.name}
          </>
        }
        actions={
          <>
            <Button variant="outline" icon="adjustments" disabled={data.isArchived} onClick={() => setAdjusting(true)}>
              تعديل المخزون
            </Button>
            <ButtonLink to={`/inventory/receive?productId=${data.id}`} variant="outline" icon="truck">
              استلام
            </ButtonLink>
            <ButtonLink to={`/products/${data.id}/edit`} variant="outline" icon="pencil">
              تعديل
            </ButtonLink>
            <Button
              variant={data.isArchived ? "primary" : "ghost"}
              loading={archive.isPending}
              onClick={() => void run(() => archive.mutateAsync({ id: data.id, archived: !data.isArchived }), data.isArchived ? `رجع «${data.name}» للمنتجات` : `انأرشف «${data.name}»`)}
            >
              {data.isArchived ? "استرجع المنتج" : "أرشف"}
            </Button>
          </>
        }
      />
      {actionError && <FormAlert>{actionError}</FormAlert>}
      <ProductHero product={data} template={template} />
      <div className="grid g-main" style={{ gap: 20 }}>
        <div className="col" style={{ gap: 16 }}>
          <article className="card">
            <div className="shead">
              <div className="shead__t">
                <span className="overline">كل نسخة ومخزونها</span>
                <h2>{data.options.length === 2 ? `خريطة ${data.options[0]!.name} و${data.options[1]!.name}` : "المخزون"}</h2>
              </div>
            </div>
            <VariantStockMap product={data} />
          </article>
          <VariantsCard
            product={data}
            busyId={archiveVariant.isPending ? (archiveVariant.variables?.variantId ?? null) : null}
            onEdit={setEditing}
            onToggleArchived={(v) =>
              void run(() => archiveVariant.mutateAsync({ id: data.id, variantId: v.id, archived: !v.isArchived }), v.isArchived ? `رجعت النسخة ${v.label}` : `انأرشفت النسخة ${v.label}`)
            }
          />
          <EmptyState title="حركة البيع" text="رح تظهر مبيعات المنتج هون بعد ما تبلّش تسجّل طلبات." />
        </div>
        <div className="col" style={{ gap: 16 }}>
          <MovementsCard movements={data.recentMovements} allHref={`/inventory/movements?productId=${data.id}`} />
        </div>
      </div>
      <AdjustStockDialog
        open={adjusting}
        productName={data.name}
        variants={data.variants.filter((v) => !v.isArchived).map((v) => ({ variantId: v.id, label: v.isDefault ? data.name : v.label, onHand: v.onHand, reserved: v.reserved }))}
        onClose={() => setAdjusting(false)}
        onDone={() => void queryClient.invalidateQueries({ queryKey: catalogKeys.all })}
      />
      <VariantEditDrawer
        variant={editing}
        supportsExpiry={template?.supportsExpiry ?? false}
        saving={updateVariant.isPending}
        onClose={() => setEditing(null)}
        onSave={async (body) => {
          await updateVariant.mutateAsync({ id: data.id, variantId: editing!.id, body });
          setEditing(null);
          toast("انحفظت النسخة");
        }}
      />
    </>
  );
}
