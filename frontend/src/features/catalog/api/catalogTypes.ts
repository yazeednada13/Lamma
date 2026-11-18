import type { MoneyString } from "@/shared/lib/money";

// Catalog contracts (API-DESIGN §12). Money values are 3-dp strings from the API.

export type StockStatusCode = "in" | "low" | "out";
export type TemplateFieldType = "text" | "number" | "select" | "date";

export interface Category {
  id: string;
  name: string;
  productCount: number;
}

export interface TemplateAxis {
  name: string;
  suggestedValues: string[];
}

export interface TemplateField {
  key: string;
  labelAr: string;
  type: TemplateFieldType;
  options: string[];
  isRequired: boolean;
  isCustom: boolean;
}

export interface ProductTemplate {
  code: string;
  nameAr: string;
  supportsExpiry: boolean;
  supportsGiftBox: boolean;
  defaultAxes: TemplateAxis[];
  fields: TemplateField[];
}

export interface TemplateFieldBody {
  labelAr: string;
  type: TemplateFieldType;
  options?: string[];
  isRequired: boolean;
}

export interface ProductListItem {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  templateCode: string;
  imageUrl: string | null;
  minPrice: MoneyString;
  maxPrice: MoneyString;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  stockStatus: StockStatusCode;
  variantCount: number;
  isArchived: boolean;
  createdAt: string;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface ProductVariant {
  id: string;
  values: string[];
  label: string;
  price: MoneyString;
  cost: MoneyString;
  priceOverride: MoneyString | null;
  costOverride: MoneyString | null;
  onHand: number;
  reserved: number;
  available: number;
  stockStatus: StockStatusCode;
  expiryDate: string | null;
  isArchived: boolean;
  isDefault: boolean;
}

export interface StockMovement {
  id: string;
  variantId: string;
  variantLabel: string;
  type: "reserve" | "release" | "sale" | "receive" | "adjustment" | "return";
  referenceKind: "opening" | "order" | "receipt" | "adjustment" | "return" | null;
  label: string | null;
  onHandDelta: number;
  reservedDelta: number;
  unitCost: MoneyString | null;
  isAutomatic: boolean;
  createdAt: string;
}

export interface ProductDetails extends Omit<ProductListItem, "variantCount"> {
  sellingPrice: MoneyString;
  cost: MoneyString;
  marginPerUnit: MoneyString;
  marginPercent: number;
  attributes: Record<string, string>;
  options: { name: string; values: string[] }[];
  variants: ProductVariant[];
  recentMovements: StockMovement[];
  updatedAt: string;
}

export interface ProductListParams {
  search?: string;
  categoryId?: string;
  uncategorized?: boolean;
  stockStatus?: StockStatusCode;
  archived?: boolean;
  sort?: "-createdAt" | "createdAt" | "name" | "-name" | "available" | "-available";
  page?: number;
  pageSize?: number;
}

export interface CreateProductBody {
  name: string;
  categoryId: string | null;
  templateCode: string;
  sellingPrice: MoneyString;
  cost: MoneyString;
  lowStockThreshold: number;
  attributes: Record<string, string>;
  expiryDate: string | null;
  options: { name: string; values: string[] }[];
  variants: { values: string[]; openingQuantity: number }[];
}

export interface UpdateProductBody {
  name: string;
  categoryId: string | null;
  templateCode: string;
  sellingPrice: MoneyString;
  cost: MoneyString;
  lowStockThreshold: number;
  attributes: Record<string, string>;
  optionNames: string[];
}

export interface AddVariantBody {
  values: string[];
  openingQuantity: number;
  expiryDate?: string | null;
  optionNames?: string[];
}

export interface UpdateVariantBody {
  priceOverride: MoneyString | null;
  costOverride: MoneyString | null;
  expiryDate: string | null;
}
