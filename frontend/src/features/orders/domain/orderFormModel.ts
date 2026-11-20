import type { PaymentMethodCode, SalesChannelCode } from "@/features/settings";
import { parseMoneyInput, type MoneyString } from "@/shared/lib/money";
import type { OrderDetails, OrderItemsBody, ProductVariantOption, ProductWithVariants } from "../api/ordersApi";

// The order form's state and its mapping to the API body (pure, unit-tested).

export interface Line {
  key: string;
  product: Pick<ProductWithVariants, "id" | "name" | "imageUrl" | "templateCode">;
  /** Selectable variants (active ones, plus the line's own variant when editing). */
  variants: ProductVariantOption[];
  variantId: string;
  quantity: number;
  /** Kept from the order being edited until the merchant changes the variant (D-032 snapshot). */
  unitPrice?: MoneyString;
}

export interface OrderFormState {
  customerId: string | null;
  channel: SalesChannelCode | null;
  lines: Line[];
  fee: string;
  discount: string;
  address: string;
  isGift: boolean;
  recipientName: string;
  recipientPhone: string;
  giftMessage: string;
  paymentMethod: PaymentMethodCode | null;
  note: string;
}

export const newLineKey = (): string => crypto.randomUUID();

export function emptyOrderForm(customerId: string | null, lines: Line[] = []): OrderFormState {
  return { customerId, channel: null, lines, fee: "0", discount: "0", address: "", isGift: false, recipientName: "", recipientPhone: "", giftMessage: "", paymentMethod: null, note: "" };
}

/** A new line for a product: its first active variant with stock that is not already on another line. */
export function lineFrom(product: ProductWithVariants, takenVariantIds: readonly string[]): Line | null {
  const active = product.variants.filter((v) => !v.isArchived);
  const variant = active.find((v) => v.available > 0 && !takenVariantIds.includes(v.id));
  if (!variant) return null;
  return { key: newLineKey(), product, variants: active, variantId: variant.id, quantity: 1 };
}

export const lineVariant = (line: Line): ProductVariantOption => line.variants.find((v) => v.id === line.variantId) ?? line.variants[0]!;

export const linePrice = (line: Line): MoneyString => line.unitPrice ?? lineVariant(line).price;

/** Form state of a «جديد» order being edited, keeping its price snapshots (D-127). */
export function formFromOrder(o: OrderDetails, products: ReadonlyMap<string, ProductWithVariants>): OrderFormState {
  return {
    customerId: o.customer.id,
    channel: o.channel,
    lines: o.items.map((item) => {
      const product = products.get(item.productId)!;
      const variants = product.variants.filter((v) => !v.isArchived || v.id === item.variantId);
      return { key: newLineKey(), product, variants, variantId: item.variantId, quantity: item.quantity, unitPrice: item.unitPrice };
    }),
    fee: o.deliveryFee,
    discount: o.discount,
    address: o.deliveryAddress ?? "",
    isGift: o.isGift,
    recipientName: o.recipientName ?? "",
    recipientPhone: o.recipientPhone ?? "",
    giftMessage: o.giftMessage ?? "",
    paymentMethod: o.paymentMethod,
    note: o.note ?? "",
  };
}

/** API body. Totals are never sent: the server computes them from the line snapshots. Gift fields only for a gift. */
export function orderBody(form: OrderFormState, channel: SalesChannelCode): OrderItemsBody {
  const text = (v: string) => v.trim() || null;
  return {
    channel,
    items: form.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, ...(l.unitPrice ? { unitPrice: l.unitPrice } : {}) })),
    deliveryFee: parseMoneyInput(form.fee) ?? "0.000",
    discount: parseMoneyInput(form.discount) ?? "0.000",
    paymentMethod: form.paymentMethod,
    deliveryAddress: text(form.address),
    isGift: form.isGift,
    recipientName: form.isGift ? text(form.recipientName) : null,
    recipientPhone: form.isGift ? text(form.recipientPhone) : null,
    giftMessage: form.isGift ? text(form.giftMessage) : null,
    note: text(form.note),
  };
}
