import { parseMoneyInput } from "@/shared/lib/money";
import { Button } from "@/shared/ui/Button";
import { ImagePicker } from "@/shared/ui/form/ImagePicker";
import { TextField } from "@/shared/ui/form/TextField";
import type { Category, StockStatusCode } from "../api/catalogTypes";
import { combinations, comboKey } from "../domain/catalogDomain";
import { ProductCard } from "./ProductCard";
import type { ExistingVariants } from "./VariantsSection";
import type { ProductFormSectionProps } from "./productFormSectionProps";

interface ProductFormAsideProps extends ProductFormSectionProps {
  categories: readonly Category[];
  existing?: ExistingVariants;
  simpleStock?: number;
  image: File | null;
  onImageChange: (file: File | null) => void;
  currentImageUrl: string | null;
  onRemoveCurrentImage?: () => void;
  imageError?: string;
  saving: boolean;
  submitLabel: string;
}

/** Live preview card, the low-stock threshold, the image and the save button (prototype `.preview-wrap`). */
export function ProductFormAside({ form, categories, existing, simpleStock, image, onImageChange, currentImageUrl, onRemoveCurrentImage, imageError, saving, submitLabel }: ProductFormAsideProps) {
  const { watch, register, formState } = form;
  const values = watch();
  const combos = combinations(values.axes);
  const stock =
    combos.length > 0
      ? combos.reduce((sum, c) => sum + (existing?.get(comboKey(c))?.onHand ?? values.quantities[comboKey(c)] ?? 0), 0)
      : (simpleStock ?? (Number.isFinite(values.simpleQuantity) ? values.simpleQuantity : 0));
  const threshold = Number.isFinite(values.lowStockThreshold) ? values.lowStockThreshold : 0;
  const status: StockStatusCode = stock <= 0 ? "out" : stock <= threshold ? "low" : "in";
  const price = parseMoneyInput(values.sellingPrice ?? "") ?? "0.000";
  const previewUrl = image ? null : currentImageUrl;

  return (
    <aside className="preview-wrap">
      <span className="preview-label">
        <i /> معاينة حيّة
      </span>
      <ProductCard
        preview
        product={{
          id: "preview",
          name: values.name?.trim() || "اسم المنتج",
          categoryName: categories.find((c) => c.id === values.categoryId)?.name ?? null,
          templateCode: values.templateCode,
          imageUrl: previewUrl,
          minPrice: price,
          maxPrice: price,
          cost: parseMoneyInput(values.cost ?? "") ?? undefined,
          onHand: stock,
          reserved: 0,
          available: stock,
          lowStockThreshold: threshold,
          stockStatus: status,
          variantCount: combos.length,
          optionLabel: combos.length > 0 ? `${combos.length} نسخة` : undefined,
        }}
      />
      <div className="card col">
        <h3>المخزون</h3>
        <TextField
          label="نبّهني لما يضل أقل من"
          type="number"
          inputMode="numeric"
          min={0}
          max={1000}
          ltr
          affix="قطع"
          error={formState.errors.lowStockThreshold?.message}
          {...register("lowStockThreshold", { valueAsNumber: true })}
        />
        <span className="caption">الكمية الافتتاحية بتتسجّل تلقائي كحركة مخزون</span>
      </div>
      <div className="card col">
        <ImagePicker value={image} onChange={onImageChange} currentUrl={currentImageUrl} onRemoveCurrent={onRemoveCurrentImage} error={imageError} label="صورة المنتج" />
      </div>
      <Button type="submit" size="lg" icon="check" loading={saving}>
        {submitLabel}
      </Button>
    </aside>
  );
}
