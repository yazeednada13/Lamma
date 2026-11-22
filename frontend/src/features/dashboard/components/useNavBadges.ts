import { useEffect } from "react";
import { useLocation } from "react-router";
import { useIndicators } from "../api/dashboardApi";

export interface NavBadgeData {
  count?: number;
  hot?: boolean;
  dot?: boolean;
  label?: string;
}

/**
 * Sidebar counters (D-158): new orders on «الطلبات» (highlighted), low and out-of-stock on «المخزون», a dot on
 * «العملاء» when anyone owes money. Refetched whenever the page changes.
 */
export function useNavBadges(): Record<string, NavBadgeData> {
  const { pathname } = useLocation();
  const indicators = useIndicators();
  const { refetch } = indicators;
  useEffect(() => {
    void refetch();
  }, [pathname, refetch]);

  const i = indicators.data;
  if (!i) return {};
  return {
    orders: { count: i.newOrders, hot: true, label: `${i.newOrders} طلبات جديدة` },
    inventory: { count: i.lowStock, label: `${i.lowStock} منتجات قرب يخلص` },
    customers: { dot: i.hasDues, label: "في عملاء عليهم مصاري" },
  };
}
