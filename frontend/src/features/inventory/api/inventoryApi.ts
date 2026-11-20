import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api/apiClient";
import { useActionKey } from "@/shared/lib/useActionKey";
import type { MoneyString } from "@/shared/lib/money";

// Inventory contracts (API-DESIGN §13).

export type AdjustmentReason = "damage" | "loss" | "count" | "correction" | "gift";

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface VariantLevel {
  variantId: string;
  label: string;
  onHand: number;
  reserved: number;
  available: number;
  cost: MoneyString;
  expiryDate: string | null;
}

export interface InventoryLevel {
  productId: string;
  name: string;
  categoryName: string | null;
  templateCode: string;
  imageUrl: string | null;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  stockStatus: "in" | "low" | "out";
  variants: VariantLevel[];
}

export interface InventorySummary {
  stockValueAtCost: MoneyString;
  retailValue: MoneyString;
  expectedProfit: MoneyString;
  pieces: number;
  reserved: number;
  productCount: number;
  lowCount: number;
  outCount: number;
  lowNames: string[];
  outNames: string[];
}

export interface MovementLogItem {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantLabel: string;
  type: string;
  referenceKind: string | null;
  label: string | null;
  adjustmentReason: AdjustmentReason | null;
  note: string | null;
  onHandDelta: number;
  reservedDelta: number;
  unitCost: MoneyString | null;
  isAutomatic: boolean;
  createdAt: string;
}

export interface ExpiringItem {
  productId: string;
  productName: string;
  templateCode: string;
  imageUrl: string | null;
  variantId: string;
  variantLabel: string;
  onHand: number;
  expiryDate: string;
  daysLeft: number;
  status: "expired" | "soon" | "ok";
}

export interface ReceiveBody {
  receivedOn: string | null;
  supplier: string | null;
  note: string | null;
  lines: { variantId: string; quantity: number; unitCost: MoneyString; expiryDate: string | null }[];
}

export interface Receipt {
  id: string;
  receivedOn: string;
  supplier: string | null;
  pieces: number;
  totalCost: MoneyString;
  lines: { productId: string; productName: string; variantId: string; variantLabel: string; quantity: number; unitCost: MoneyString; lineTotal: MoneyString; newOnHand: number; newCost: MoneyString }[];
}

export interface AdjustBody {
  variantId: string;
  delta: number;
  reason: AdjustmentReason;
  note: string | null;
}

export interface Adjustment {
  movementId: string;
  productId: string;
  productName: string;
  variantId: string;
  variantLabel: string;
  delta: number;
  onHand: number;
  reserved: number;
  available: number;
}

export interface LevelsParams {
  search?: string;
  status?: "low" | "out";
  page?: number;
  pageSize?: number;
}

export interface MovementsParams {
  direction?: "in" | "out";
  origin?: "auto" | "manual";
  productId?: string;
  page?: number;
  pageSize?: number;
}

export const inventoryKeys = {
  all: ["inventory"] as const,
  levels: (p: LevelsParams) => ["inventory", "levels", p] as const,
  summary: ["inventory", "summary"] as const,
  movements: (p: MovementsParams) => ["inventory", "movements", p] as const,
  expiring: ["inventory", "expiring"] as const,
};

function qs(params: object): string {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)]));
  const text = s.toString();
  return text ? `?${text}` : "";
}

export const useInventoryLevels = (p: LevelsParams) =>
  useQuery({ queryKey: inventoryKeys.levels(p), queryFn: () => api.get<Paged<InventoryLevel>>(`/inventory/levels${qs(p)}`), placeholderData: keepPreviousData });

export const useInventorySummary = () => useQuery({ queryKey: inventoryKeys.summary, queryFn: () => api.get<InventorySummary>("/inventory/summary") });

export const useMovementLog = (p: MovementsParams) =>
  useQuery({ queryKey: inventoryKeys.movements(p), queryFn: () => api.get<Paged<MovementLogItem>>(`/inventory/movements${qs(p)}`), placeholderData: keepPreviousData });

export const useExpiring = () => useQuery({ queryKey: inventoryKeys.expiring, queryFn: () => api.get<ExpiringItem[]>("/inventory/expiring") });

export { useActionKey };

function useStockMutation<TBody, TResult>(path: string) {
  const queryClient = useQueryClient();
  const actionKey = useActionKey();
  const mutation = useMutation({
    mutationFn: (body: TBody) => api.post<TResult>(path, body, { idempotencyKey: actionKey.keyFor(body) }),
    onSuccess: () => {
      actionKey.done();
      void queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
  return mutation;
}

export const useReceiveStock = () => useStockMutation<ReceiveBody, Receipt>("/inventory/receipts");

export const useAdjustStock = () => useStockMutation<AdjustBody, Adjustment>("/inventory/adjustments");
