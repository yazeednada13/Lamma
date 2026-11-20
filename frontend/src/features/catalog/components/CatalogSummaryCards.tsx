import { useInventorySummary } from "@/features/inventory";
import { formatMoneyNumber } from "@/shared/lib/money";
import { MetricCard } from "@/shared/ui/MetricCard";

/** The prototype's three product-page cards, from the server-computed inventory summary (D-113). */
export function CatalogSummaryCards() {
  const summary = useInventorySummary();
  const s = summary.data;
  if (!s || s.productCount === 0) return null;
  return (
    <div className="grid g-3">
      <MetricCard icon="package" tone="olive" label="قيمة البضاعة (بالتكلفة)" value={formatMoneyNumber(s.stockValueAtCost)} unit="د.أ" foot={`بسعر البيع ${formatMoneyNumber(s.retailValue)} د.أ`} />
      <MetricCard icon="wallet" tone="green" label="ربح متوقع من المخزون" value={formatMoneyNumber(s.expectedProfit)} unit="د.أ" foot="لو انباع كل اللي عندك" />
      <MetricCard icon="alert-triangle" tone="apricot" label="بحاجة انتباه" value={s.lowCount + s.outCount} foot={`${s.lowCount} قرب يخلص · ${s.outCount} نفد`} to="/inventory" />
    </div>
  );
}
