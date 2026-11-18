import { parseMoneyInput, formatMoneyNumber } from "@/shared/lib/money";
import type { AddVariantBody, CreateProductBody, ProductDetails, ProductTemplate, UpdateProductBody } from "../api/catalogTypes";
import type { ProductFormValues } from "../schemas/productFormSchema";
import { activeAxes, combinations, comboKey, type Axis } from "./catalogDomain";

// Pure mapping between the product form and the API bodies (no React, unit-tested).

/** Axes of a new product: the template's default axes with no values chosen yet. */
export function templateAxes(template: ProductTemplate | undefined): Axis[] {
  return (template?.defaultAxes ?? []).map((a) => ({ name: a.name, values: [] }));
}

export function emptyFormValues(template: ProductTemplate | undefined, lowStockThreshold: number): ProductFormValues {
  return {
    templateCode: template?.code ?? "other",
    name: "",
    sellingPrice: "",
    cost: "",
    categoryId: "",
    lowStockThreshold,
    attributes: {},
    expiryDate: "",
    axes: templateAxes(template),
    quantities: {},
    simpleQuantity: 0,
  };
}

/** Form values of a saved product (edit mode). Quantities are only for new combinations. */
export function formValuesFromProduct(product: ProductDetails): ProductFormValues {
  const plain = (money: string) => formatMoneyNumber(money).replace(/,/g, "");
  return {
    templateCode: product.templateCode,
    name: product.name,
    sellingPrice: plain(product.sellingPrice),
    cost: plain(product.cost),
    categoryId: product.categoryId ?? "",
    lowStockThreshold: product.lowStockThreshold,
    attributes: { ...product.attributes },
    expiryDate: product.variants.find((v) => !v.isArchived)?.expiryDate ?? "",
    axes: product.options.map((o) => ({ name: o.name, values: [...o.values] })),
    quantities: {},
    simpleQuantity: 0,
  };
}

/** Saved variants by combination key, for the matrix (archived ones included so they are never re-created). */
export function existingVariants(product: ProductDetails): Map<string, { onHand: number; isArchived: boolean }> {
  return new Map(product.variants.filter((v) => !v.isDefault).map((v) => [comboKey(v.values), { onHand: v.onHand, isArchived: v.isArchived }]));
}

/** Attributes the template knows, without empty values. */
function attributesFor(values: ProductFormValues, template: ProductTemplate): Record<string, string> {
  const keys = new Set(template.fields.map((f) => f.key));
  return Object.fromEntries(Object.entries(values.attributes ?? {}).filter(([k, v]) => keys.has(k) && v.trim() !== "").map(([k, v]) => [k, v.trim()]));
}

const money = (text: string) => parseMoneyInput(text) ?? "0.000";

export function createBody(values: ProductFormValues, template: ProductTemplate): CreateProductBody {
  const axes = activeAxes(values.axes);
  const combos = combinations(values.axes);
  return {
    name: values.name.trim(),
    categoryId: values.categoryId || null,
    templateCode: template.code,
    sellingPrice: money(values.sellingPrice),
    cost: money(values.cost),
    lowStockThreshold: values.lowStockThreshold,
    attributes: attributesFor(values, template),
    expiryDate: template.supportsExpiry && values.expiryDate ? values.expiryDate : null,
    options: axes.map((a) => ({ name: a.name.trim(), values: a.values })),
    variants:
      combos.length > 0
        ? combos.map((c) => ({ values: c, openingQuantity: values.quantities[comboKey(c)] ?? 0 }))
        : values.simpleQuantity > 0
          ? [{ values: [], openingQuantity: values.simpleQuantity }]
          : [],
  };
}

export function updateBody(values: ProductFormValues, template: ProductTemplate, product: ProductDetails): UpdateProductBody {
  // Axis names are renamed in place; their count is fixed after creation (D-093).
  const savedAxes = product.options.length;
  return {
    name: values.name.trim(),
    categoryId: values.categoryId || null,
    templateCode: template.code,
    sellingPrice: money(values.sellingPrice),
    cost: money(values.cost),
    lowStockThreshold: values.lowStockThreshold,
    attributes: attributesFor(values, template),
    optionNames: values.axes.slice(0, savedAxes).map((a, i) => a.name.trim() || product.options[i]!.name),
  };
}

/**
 * New variants to add after the update, in matrix order. For a simple product the first one carries the
 * option names, which converts it (allowed only at zero stock, D-090).
 */
export function newVariantBodies(values: ProductFormValues, template: ProductTemplate, product: ProductDetails): AddVariantBody[] {
  const saved = existingVariants(product);
  const expiryDate = template.supportsExpiry && values.expiryDate ? values.expiryDate : null;
  const converting = product.options.length === 0;
  const names = activeAxes(values.axes).map((a) => a.name.trim());
  return combinations(values.axes)
    .filter((c) => !saved.has(comboKey(c)))
    .map((c, i) => ({
      values: c,
      openingQuantity: values.quantities[comboKey(c)] ?? 0,
      expiryDate,
      ...(converting && i === 0 ? { optionNames: names } : {}),
    }));
}
