import { useEffect, useState } from "react";
import { errorMessage } from "@/services/api/apiClient";
import { Button, ButtonLink } from "@/shared/ui/Button";
import { Chip } from "@/shared/ui/Chip";
import { EmptyState } from "@/shared/ui/feedback/EmptyState";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Icon } from "@/shared/ui/Icon";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useInventoryLevels, useInventorySummary, type InventoryLevel } from "../api/inventoryApi";
import { AdjustStockDialog } from "../components/AdjustStockDialog";
import { InventoryHero, StockRow } from "../components/InventoryVisuals";

const PAGE_SIZE = 30;

/** Stock levels (prototype `#/inventory`): summary band, search, low/out filters, most urgent first. */
export function InventoryPage() {
  const [status, setStatus] = useState<"low" | "out" | undefined>();
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [adjusting, setAdjusting] = useState<InventoryLevel | null>(null);
  const summary = useInventorySummary();
  const levels = useInventoryLevels({ search: search || undefined, status, page, pageSize: PAGE_SIZE });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchText]);

  const choose = (next: "low" | "out" | undefined) => {
    setStatus(next);
    setPage(1);
  };
  const pages = levels.data ? Math.max(1, Math.ceil(levels.data.totalCount / PAGE_SIZE)) : 1;
  const error = summary.error ?? levels.error;

  return (
    <>
      <PageHeader
        title="مستوى المخزون"
        subtitle="المتوفر = الموجود − المحجوز للطلبات المؤكدة"
        actions={
          <>
            <ButtonLink to="/inventory/movements" variant="outline" icon="list">
              سجل الحركات
            </ButtonLink>
            <ButtonLink to="/inventory/receive" icon="truck">
              استلام بضاعة
            </ButtonLink>
          </>
        }
      />
      {error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void Promise.all([summary.refetch(), levels.refetch()])} />
      ) : !summary.data || !levels.data ? (
        <PageSkeleton />
      ) : summary.data.productCount === 0 ? (
        <EmptyState title="ما في منتجات لسا" text="أضف منتجاتك أول، وبعدين تابع مخزونها من هون.">
          <ButtonLink to="/products/new" icon="plus">
            أضف منتج
          </ButtonLink>
        </EmptyState>
      ) : (
        <>
          <InventoryHero summary={summary.data} />
          <div className="table-wrap">
            <div className="toolbar">
              <span className="control control--search" style={{ height: 40, width: "min(260px, 100%)" }}>
                <Icon name="search" />
                <input placeholder="منتج" aria-label="ابحث عن منتج" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
              </span>
              <div className="row" style={{ gap: 6 }} role="group" aria-label="فلترة المخزون">
                <Chip selected={status === undefined} onClick={() => choose(undefined)}>
                  الكل <b className="num">{summary.data.productCount}</b>
                </Chip>
                <Chip selected={status === "low"} onClick={() => choose("low")}>
                  قرب يخلص <b className="num">{summary.data.lowCount}</b>
                </Chip>
                <Chip selected={status === "out"} onClick={() => choose("out")}>
                  نفد <b className="num">{summary.data.outCount}</b>
                </Chip>
              </div>
            </div>
            {levels.data.items.length === 0 ? (
              <p className="muted" style={{ padding: 18 }}>
                ما في منتجات بهالفلتر.
              </p>
            ) : (
              levels.data.items.map((level) => <StockRow key={level.productId} level={level} onAdjust={setAdjusting} />)
            )}
          </div>
          {pages > 1 && (
            <nav className="row" style={{ justifyContent: "center", gap: 12, marginTop: 16 }} aria-label="الصفحات">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                السابق
              </Button>
              <span className="caption">
                صفحة <bdi>{page}</bdi> من <bdi>{pages}</bdi>
              </span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                التالي
              </Button>
            </nav>
          )}
        </>
      )}
      <AdjustStockDialog open={adjusting !== null} productName={adjusting?.name ?? ""} variants={adjusting?.variants ?? []} onClose={() => setAdjusting(null)} />
    </>
  );
}
