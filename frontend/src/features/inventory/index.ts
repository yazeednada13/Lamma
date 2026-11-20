// Public API of the inventory feature. Other code imports from "@/features/inventory" only.
export { inventoryRoutes } from "./routes";
export { AdjustStockDialog, type AdjustableVariant } from "./components/AdjustStockDialog";
export { useInventorySummary, type InventorySummary } from "./api/inventoryApi";
