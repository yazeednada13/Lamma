import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { OrderPaymentLine, PaymentStatus } from "@/features/payments";
import type { PaymentMethodCode, SalesChannelCode } from "@/features/settings";
import { api } from "@/services/api/apiClient";
import type { MoneyString } from "@/shared/lib/money";
import { useActionKey } from "@/shared/lib/useActionKey";

// Orders contracts (API-DESIGN §15).

export type OrderStatus = "new" | "confirmed" | "preparing" | "courier" | "delivered" | "cancelled" | "returned";
export type CancelReason = "changed_mind" | "no_answer" | "unavailable" | "other";

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface OrderListItem {
  id: string;
  number: number;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  channel: SalesChannelCode;
  status: OrderStatus;
  nextStatus: OrderStatus | null;
  pieces: number;
  items: { productName: string; variantLabel: string | null; quantity: number }[];
  total: MoneyString;
  createdAt: string;
  deliveredAt: string | null;
  /** Phase 6 (D-133): Σ active payments, what is left, and the derived status (null when cancelled). */
  paid: MoneyString;
  remaining: MoneyString;
  paymentStatus: PaymentStatus | null;
  /** Phase 8 (D-148): value of the returned pieces; remaining uses total − returnedAmount. */
  returnedAmount: MoneyString;
  /** Pre-order (D-151): business-local YYYY-MM-DD and HH:mm. */
  expectedDeliveryOn: string | null;
  expectedDeliveryTime: string | null;
}

export type OrderStatusCounts = Record<OrderStatus | "all", number>;

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  variantLabel: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPrice: MoneyString;
  unitCost: MoneyString;
  lineTotal: MoneyString;
  returnedQuantity: number;
}

export interface OrderReturn {
  id: string;
  returnedOn: string;
  amount: MoneyString;
  reason: string | null;
  refundAmount: MoneyString;
  refundMethod: PaymentMethodCode | null;
  recordedAt: string;
  lines: {
    orderItemId: string;
    productName: string;
    variantLabel: string | null;
    quantity: number;
    restocked: boolean;
  }[];
}

export interface PreOrder {
  id: string;
  number: number;
  customerId: string;
  customerName: string;
  status: OrderStatus;
  expectedDeliveryOn: string;
  expectedDeliveryTime: string | null;
  items: { productName: string; variantLabel: string | null; quantity: number }[];
  total: MoneyString;
}

export interface OrderStatusChange {
  id: string;
  from: OrderStatus | null;
  to: OrderStatus;
  changedAt: string;
  isUndo: boolean;
  cancelReason: CancelReason | null;
  note: string | null;
}

export interface OrderUndo {
  changeId: string;
  from: OrderStatus;
  to: OrderStatus;
  availableUntil: string;
}

export interface OrderDetails {
  id: string;
  number: number;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    city: string | null;
    area: string | null;
    isArchived: boolean;
  };
  channel: SalesChannelCode;
  status: OrderStatus;
  nextStatus: OrderStatus | null;
  allowedStatuses: OrderStatus[];
  canEditItems: boolean;
  canEditDetails: boolean;
  items: OrderItem[];
  pieces: number;
  itemsSubtotal: MoneyString;
  deliveryFee: MoneyString;
  discount: MoneyString;
  total: MoneyString;
  itemsCost: MoneyString;
  profit: MoneyString;
  paymentMethod: PaymentMethodCode | null;
  deliveryAddress: string | null;
  isGift: boolean;
  recipientName: string | null;
  recipientPhone: string | null;
  giftMessage: string | null;
  note: string | null;
  cancelReason: CancelReason | null;
  cancelNote: string | null;
  timeline: OrderStatusChange[];
  undo: OrderUndo | null;
  createdAt: string;
  confirmedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  updatedAt: string;
  paid: MoneyString;
  remaining: MoneyString;
  paymentStatus: PaymentStatus | null;
  /** Payments applied to this order, reversed ones included (D-136). */
  payments: OrderPaymentLine[];
  returnedAmount: MoneyString;
  netTotal: MoneyString;
  isPartiallyReturned: boolean;
  canReturn: boolean;
  returns: OrderReturn[];
  expectedDeliveryOn: string | null;
  expectedDeliveryTime: string | null;
}

export interface OrderDetailsBody {
  deliveryAddress: string | null;
  isGift: boolean;
  recipientName: string | null;
  recipientPhone: string | null;
  giftMessage: string | null;
  note: string | null;
  /** Always sent: omitting them would clear the pre-order schedule (D-151). */
  expectedDeliveryOn: string | null;
  expectedDeliveryTime: string | null;
}

export interface OrderItemsBody extends OrderDetailsBody {
  channel: SalesChannelCode;
  items: { variantId: string; quantity: number; unitPrice?: MoneyString }[];
  deliveryFee: MoneyString;
  discount: MoneyString;
  paymentMethod: PaymentMethodCode | null;
}

export interface CreateOrderBody extends OrderItemsBody {
  customerId: string;
  status: "new" | "confirmed";
  /** Optional deposit, dated today (D-135). */
  payment?: { amount: MoneyString; method: PaymentMethodCode };
}

export interface OrderListParams {
  search?: string;
  status?: OrderStatus;
  from?: string;
  to?: string;
  customerId?: string;
  productId?: string;
  sort?: "-createdAt" | "createdAt" | "-total";
  isPreOrder?: boolean;
  page?: number;
  pageSize?: number;
}

// Lookups of other modules' endpoints used by the order form (read-only, own minimal types).

export interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
  channel: SalesChannelCode;
  city: string | null;
  area: string | null;
  orderCount: number;
  balanceDue: MoneyString;
  isArchived: boolean;
}

export interface ProductOption {
  id: string;
  name: string;
  templateCode: string;
  imageUrl: string | null;
  minPrice: MoneyString;
  available: number;
  variantCount: number;
}

export interface ProductVariantOption {
  id: string;
  label: string;
  price: MoneyString;
  cost: MoneyString;
  available: number;
  isArchived: boolean;
  isDefault: boolean;
}

export interface ProductWithVariants {
  id: string;
  name: string;
  templateCode: string;
  imageUrl: string | null;
  isArchived: boolean;
  variants: ProductVariantOption[];
}

export const orderKeys = {
  all: ["orders"] as const,
  list: (p: OrderListParams) => ["orders", "list", p] as const,
  counts: (p: OrderListParams) => ["orders", "counts", p] as const,
  detail: (id: string) => ["orders", "detail", id] as const,
};

function qs(params: object): string {
  const s = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  );
  const text = s.toString();
  return text ? `?${text}` : "";
}

export const useOrders = (p: OrderListParams, enabled = true) =>
  useQuery({
    queryKey: orderKeys.list(p),
    queryFn: () => api.get<Paged<OrderListItem>>(`/orders${qs(p)}`),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useOrderStatusCounts = (p: Omit<OrderListParams, "status" | "page" | "pageSize" | "sort">) =>
  useQuery({
    queryKey: orderKeys.counts(p),
    queryFn: () => api.get<OrderStatusCounts>(`/orders/status-counts${qs(p)}`),
    placeholderData: keepPreviousData,
  });

export const useOrder = (id: string | undefined) =>
  useQuery({
    queryKey: orderKeys.detail(id ?? ""),
    queryFn: () => api.get<OrderDetails>(`/orders/${id}`),
    enabled: Boolean(id),
  });

export const useCustomerOptions = (search: string) =>
  useQuery({
    queryKey: ["orders", "lookup", "customers", search],
    queryFn: () =>
      api.get<Paged<CustomerOption>>(
        `/customers${qs({ search: search || undefined, pageSize: 8, sort: search ? undefined : "-createdAt" })}`,
      ),
    placeholderData: keepPreviousData,
  });

export const useCustomerOption = (id: string | null) =>
  useQuery({
    queryKey: ["orders", "lookup", "customer", id],
    queryFn: () => api.get<CustomerOption>(`/customers/${id}`),
    enabled: Boolean(id),
  });

export const useProductOptions = (search: string) =>
  useQuery({
    queryKey: ["orders", "lookup", "products", search],
    queryFn: () => api.get<Paged<ProductOption>>(`/products${qs({ search: search || undefined, pageSize: 12 })}`),
    placeholderData: keepPreviousData,
  });

const productKey = (id: string | null) => ["orders", "lookup", "product", id] as const;
const getProduct = (id: string) => api.get<ProductWithVariants>(`/products/${id}`);

/** A product preselected from its page ("طلب جديد"), with its variants. */
export const useProductWithVariants = (id: string | null) =>
  useQuery({ queryKey: productKey(id), queryFn: () => getProduct(id!), enabled: Boolean(id) });

/** The products of an order being edited, with their variants. */
export const useProductsWithVariants = (ids: readonly string[]) =>
  useQueries({ queries: ids.map((id) => ({ queryKey: productKey(id), queryFn: () => getProduct(id) })) });

/** The product with its variants' current price, cost and availability (for a new order line). */
export const fetchProductWithVariants = (queryClient: QueryClient, productId: string) =>
  queryClient.fetchQuery({ queryKey: productKey(productId), queryFn: () => getProduct(productId), staleTime: 0 });

/** Orders change stock, product, customer and receivable figures: refresh all of them. */
function invalidateAfterOrderChange(queryClient: QueryClient) {
  for (const key of [orderKeys.all, ["catalog"], ["inventory"], ["customers"], ["payments"]]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

function useOrderMutation<TArgs>(fn: (args: TArgs, key: (body: unknown) => string) => Promise<OrderDetails>) {
  const queryClient = useQueryClient();
  const actionKey = useActionKey();
  return useMutation({
    mutationFn: (args: TArgs) => fn(args, (body) => actionKey.keyFor(body)),
    onSuccess: (order) => {
      actionKey.done();
      queryClient.setQueryData(orderKeys.detail(order.id), order);
      invalidateAfterOrderChange(queryClient);
    },
  });
}

export const useCreateOrder = () =>
  useOrderMutation((body: CreateOrderBody, key) =>
    api.post<OrderDetails>("/orders", body, { idempotencyKey: key(body) }),
  );

export const useUpdateOrder = () =>
  useOrderMutation(({ id, body }: { id: string; body: OrderItemsBody }) =>
    api.put<OrderDetails>(`/orders/${id}`, body),
  );

export const useUpdateOrderDetails = () =>
  useOrderMutation(({ id, body }: { id: string; body: OrderDetailsBody }) =>
    api.put<OrderDetails>(`/orders/${id}/details`, body),
  );

export interface StatusChangeArgs {
  id: string;
  to: OrderStatus;
  expectedStatus: OrderStatus;
  cancelReason?: CancelReason;
  cancelNote?: string | null;
}

export const useChangeOrderStatus = () =>
  useOrderMutation(({ id, ...body }: StatusChangeArgs, key) =>
    api.post<OrderDetails>(`/orders/${id}/status`, body, { idempotencyKey: key({ id, ...body }) }),
  );

export const useUndoOrderStatus = () =>
  useOrderMutation(({ id, changeId }: { id: string; changeId: string }, key) =>
    api.post<OrderDetails>(`/orders/${id}/status/undo`, { changeId }, { idempotencyKey: key({ id, changeId }) }),
  );

export interface ReturnBody {
  lines: { orderItemId: string; quantity: number; restock: boolean }[];
  returnedOn: string;
  reason: string | null;
  refund: { amount: MoneyString; method: PaymentMethodCode } | null;
}

/** A return (D-145–D-150): final; refreshes stock, payments and figures like a status change. */
export const useReturnOrder = () =>
  useOrderMutation(({ id, body }: { id: string; body: ReturnBody }, key) =>
    api.post<OrderDetails>(`/orders/${id}/returns`, body, { idempotencyKey: key({ id, body }) }),
  );

export const usePreOrders = (from: string, to: string) =>
  useQuery({
    queryKey: ["orders", "preorders", from, to],
    queryFn: () => api.get<PreOrder[]>(`/orders/preorders${qs({ from, to })}`),
    placeholderData: keepPreviousData,
  });

/** Refreshes everything an order touches (e.g. after a 409 that tells us the data changed). */
export function useRefreshOrders() {
  const queryClient = useQueryClient();
  return () => invalidateAfterOrderChange(queryClient);
}
