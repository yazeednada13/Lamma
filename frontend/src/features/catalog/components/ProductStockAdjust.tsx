import { useQueryClient } from "@tanstack/react-query";
import { AdjustStockDialog } from "@/features/inventory";
import { catalogKeys, useProduct } from "../api/catalogApi";

/** Adjust stock from a product card: loads the product's variants, then opens the inventory dialog. */
export function ProductStockAdjust({ productId, onClose }: { productId: string | null; onClose: () => void }) {
  const product = useProduct(productId ?? undefined);
  const queryClient = useQueryClient();
  const data = productId ? product.data : undefined;
  return (
    <AdjustStockDialog
      open={Boolean(data)}
      productName={data?.name ?? ""}
      variants={(data?.variants ?? []).filter((v) => !v.isArchived).map((v) => ({ variantId: v.id, label: v.isDefault ? data!.name : v.label, onHand: v.onHand, reserved: v.reserved }))}
      onClose={onClose}
      onDone={() => void queryClient.invalidateQueries({ queryKey: catalogKeys.all })}
    />
  );
}
