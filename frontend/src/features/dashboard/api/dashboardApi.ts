import { useQuery } from "@tanstack/react-query";
import type { SalesChannelCode } from "@/features/settings";
import { api } from "@/services/api/apiClient";
import type { MoneyString } from "@/shared/lib/money";

// Dashboard contracts (API-DESIGN §19).

export interface PeriodFigure {
  current: MoneyString;
  previous: MoneyString;
  /** % change, 1 decimal; null when there is no earlier figure (D-153). */
  change: number | null;
}

export interface Journey {
  products: number;
  lowStock: number;
  newOrders: number;
  preparing: number;
  courier: number;
  deliveredThisMonth: number;
  activeCustomers: number;
}

export type AttentionKind = "prepare" | "confirm" | "low_stock" | "courier" | "due";

export interface AttentionItem {
  kind: AttentionKind;
  priority: "high" | "mid" | "low";
  count: number | null;
  amount: MoneyString | null;
  refId: string | null;
  name: string | null;
  orderNumber: number | null;
  since: string | null;
  available: number | null;
  threshold: number | null;
}

export interface ActivityItem {
  kind: "order" | "movement" | "expense";
  at: string;
  name: string | null;
  number: number | null;
  amount: MoneyString | null;
  type: "receive" | "adjustment" | "return" | null;
  quantity: number | null;
  label: string | null;
}

export interface Dashboard {
  today: string;
  monthStart: string;
  netProfit: PeriodFigure;
  sales: PeriodFigure;
  grossProfit: MoneyString;
  cashReceived: MoneyString;
  receivables: MoneyString;
  courierHeld: MoneyString;
  openOrders: number;
  openValue: MoneyString;
  journey: Journey;
  series: { day: string; sales: MoneyString; grossProfit: MoneyString }[];
  attention: AttentionItem[];
  channels: { channel: SalesChannelCode; amount: MoneyString }[];
  topProducts: { productId: string; name: string; quantity: number; revenue: MoneyString }[];
  latestOrders: {
    id: string;
    number: number;
    customerName: string;
    status: string;
    total: MoneyString;
    createdAt: string;
  }[];
  activity: ActivityItem[];
  insight: {
    topChannel: SalesChannelCode | null;
    topChannelShare: number | null;
    topProduct: string | null;
    bestWeekday: number | null;
  };
  trialDaysLeft: number;
  isEmpty: boolean;
}

export interface Indicators {
  newOrders: number;
  lowStock: number;
  hasDues: boolean;
}

/** A product under its threshold (read from the inventory endpoint with own minimal types). */
export interface LowProduct {
  productId: string;
  name: string;
  templateCode: string;
  imageUrl: string | null;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
}

export const dashboardKeys = {
  all: ["dashboard"] as const,
  indicators: ["dashboard", "indicators"] as const,
};

/** The dashboard refetches on every visit: it summarises everything else. */
export const useDashboard = () =>
  useQuery({ queryKey: dashboardKeys.all, queryFn: () => api.get<Dashboard>("/dashboard"), staleTime: 0 });

/** Sidebar counters (D-158): light, refreshed on navigation by the caller. */
export const useIndicators = () =>
  useQuery({
    queryKey: dashboardKeys.indicators,
    queryFn: () => api.get<Indicators>("/dashboard/indicators"),
    staleTime: 30_000,
  });

/** «قرب يخلص»: out-of-stock first, then low, at most 4. */
export const useLowProducts = () =>
  useQuery({
    queryKey: ["dashboard", "low-products"],
    queryFn: async () => {
      const [out, low] = await Promise.all([
        api.get<{ items: LowProduct[] }>("/inventory/levels?status=out&pageSize=4"),
        api.get<{ items: LowProduct[] }>("/inventory/levels?status=low&pageSize=4"),
      ]);
      return [...out.items, ...low.items].slice(0, 4);
    },
    staleTime: 0,
  });
