import { useEffect, useState } from "react";
import { errorMessage } from "@/services/api/apiClient";
import { Button, ButtonLink } from "@/shared/ui/Button";
import { Chip } from "@/shared/ui/Chip";
import { EmptyShelf } from "@/shared/ui/brand/EmptyScenes";
import { EmptyState } from "@/shared/ui/feedback/EmptyState";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Icon } from "@/shared/ui/Icon";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useCategories, useProducts } from "../api/catalogApi";
import type { ProductListParams } from "../api/catalogTypes";
import { CatalogSummaryCards } from "../components/CatalogSummaryCards";
import { ProductCard } from "../components/ProductCard";
import { ProductStockAdjust } from "../components/ProductStockAdjust";
import { ProductsTable } from "../components/ProductsTable";

const PAGE_SIZE = 24;
const VIEW_KEY = "lamma.products.view";

type Filter = { kind: "all" } | { kind: "category"; id: string } | { kind: "uncategorized" } | { kind: "low" } | { kind: "out" } | { kind: "archived" };

function toParams(filter: Filter, search: string, page: number): ProductListParams {
  const params: ProductListParams = { search: search || undefined, page, pageSize: PAGE_SIZE };
  switch (filter.kind) {
    case "category":
      return { ...params, categoryId: filter.id };
    case "uncategorized":
      return { ...params, uncategorized: true };
    case "low":
      return { ...params, stockStatus: "low" };
    case "out":
      return { ...params, stockStatus: "out" };
    case "archived":
      return { ...params, archived: true };
    default:
      return params;
  }
}

function readView(): "grid" | "list" {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

/** Products list (prototype `#/products`): search, category and stock filters, cards or table, paging. */
export function ProductsPage() {
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"grid" | "list">(readView);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const categories = useCategories();
  const products = useProducts(toParams(filter, search, page));

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchText.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchText]);

  const choose = (next: Filter) => {
    setFilter(next);
    setPage(1);
  };

  const changeView = (next: "grid" | "list") => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // per-viewer convenience only
    }
  };

  const data = products.data;
  const isFiltered = filter.kind !== "all" || search !== "";
  const pages = data ? Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE)) : 1;
  const selected = (kind: Filter["kind"], id?: string) => filter.kind === kind && (kind !== "category" || (filter.kind === "category" && filter.id === id));

  return (
    <>
      <PageHeader
        title="المنتجات"
        subtitle={data && categories.data ? `${data.totalCount} منتج · ${categories.data.length} تصنيفات` : undefined}
        actions={
          <>
            <ButtonLink to="/products/categories" variant="outline" icon="tag">
              التصنيفات
            </ButtonLink>
            <ButtonLink to="/products/new" icon="plus">
              منتج جديد
            </ButtonLink>
          </>
        }
      />
      <CatalogSummaryCards />
      <div className="toolbar card" style={{ padding: "12px 16px", borderRadius: 16 }}>
        <span className="control control--search" style={{ height: 40, width: "min(280px, 100%)" }}>
          <Icon name="search" />
          <input placeholder="اسم المنتج" aria-label="ابحث عن منتج" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </span>
        <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="فلترة المنتجات">
          <Chip selected={selected("all")} onClick={() => choose({ kind: "all" })}>
            الكل
          </Chip>
          {categories.data?.map((c) => (
            <Chip key={c.id} selected={selected("category", c.id)} onClick={() => choose({ kind: "category", id: c.id })}>
              {c.name}
            </Chip>
          ))}
          <Chip selected={selected("uncategorized")} onClick={() => choose({ kind: "uncategorized" })}>
            بدون تصنيف
          </Chip>
          <Chip selected={selected("low")} onClick={() => choose({ kind: "low" })}>
            <Icon name="alert-triangle" size={16} /> قرب يخلص
          </Chip>
          <Chip selected={selected("out")} onClick={() => choose({ kind: "out" })}>
            نفد
          </Chip>
          <Chip selected={selected("archived")} onClick={() => choose({ kind: "archived" })}>
            المؤرشفة
          </Chip>
        </div>
        <div className="vtoggle end" role="group" aria-label="طريقة العرض">
          <button type="button" className={view === "grid" ? "is-active" : undefined} aria-label="بطاقات" aria-pressed={view === "grid"} onClick={() => changeView("grid")}>
            <Icon name="layout-grid" size={16} />
          </button>
          <button type="button" className={view === "list" ? "is-active" : undefined} aria-label="جدول" aria-pressed={view === "list"} onClick={() => changeView("list")}>
            <Icon name="list" size={16} />
          </button>
        </div>
      </div>

      {products.error ? (
        <ErrorState message={errorMessage(products.error)} onRetry={() => void products.refetch()} />
      ) : !data ? (
        <PageSkeleton />
      ) : data.items.length === 0 ? (
        isFiltered ? (
          <EmptyState title="ما في منتجات هون" text="جرّب فلتر ثاني أو أضف منتج جديد.">
            <ButtonLink to="/products/new" icon="plus">
              منتج جديد
            </ButtonLink>
          </EmptyState>
        ) : (
          <EmptyState art={<EmptyShelf />} title="لسا ما أضفت منتجات" text="أضف أول منتج بالمقاسات والألوان وكمية كل وحدة.">
            <ButtonLink to="/products/new" icon="plus">
              أضف منتج
            </ButtonLink>
          </EmptyState>
        )
      ) : (
        <>
          {view === "grid" ? (
            <div className="products-grid stagger">
              {data.items.map((p, i) => (
                <ProductCard key={p.id} product={{ ...p, optionLabel: p.variantCount > 0 ? `${p.variantCount} نسخة` : undefined }} index={i} onAdjust={p.isArchived ? undefined : () => setAdjustingId(p.id)} />
              ))}
            </div>
          ) : (
            <ProductsTable products={data.items} />
          )}
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
      <ProductStockAdjust productId={adjustingId} onClose={() => setAdjustingId(null)} />
    </>
  );
}
