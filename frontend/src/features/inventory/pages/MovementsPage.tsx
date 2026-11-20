import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { errorMessage } from "@/services/api/apiClient";
import { Button, ButtonLink } from "@/shared/ui/Button";
import { Chip } from "@/shared/ui/Chip";
import { EmptyState } from "@/shared/ui/feedback/EmptyState";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useMovementLog, type MovementsParams } from "../api/inventoryApi";
import { groupByDay, reasonLabel } from "../domain/inventoryDomain";

type Filter = "" | "in" | "out" | "auto" | "manual";
const FILTERS: { value: Filter; label: string; icon?: IconName }[] = [
  { value: "", label: "الكل" },
  { value: "in", label: "داخل", icon: "upload" },
  { value: "out", label: "طالع", icon: "package" },
  { value: "auto", label: "تلقائي", icon: "clock" },
  { value: "manual", label: "يدوي", icon: "pencil" },
];
const PAGE_SIZE = 50;
const time = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { timeZone: "Asia/Amman", hour: "numeric", minute: "2-digit" });

/** Movement log (prototype `#/inventory/movements`): filters, grouped by day (Asia/Amman), newest first. */
export function MovementsPage() {
  const [params] = useSearchParams();
  const productId = params.get("productId") ?? undefined;
  const [filter, setFilter] = useState<Filter>("");
  const [page, setPage] = useState(1);
  const query: MovementsParams = {
    productId,
    page,
    pageSize: PAGE_SIZE,
    direction: filter === "in" || filter === "out" ? filter : undefined,
    origin: filter === "auto" || filter === "manual" ? filter : undefined,
  };
  const log = useMovementLog(query);
  const pages = log.data ? Math.max(1, Math.ceil(log.data.totalCount / PAGE_SIZE)) : 1;
  let index = 0;

  return (
    <>
      <PageHeader
        title="سجل حركات المخزون"
        subtitle={productId && log.data?.items[0] ? `حركات «${log.data.items[0].productName}»` : "كل زيادة أو نقص، ومن وين إجت"}
        crumbs={
          <>
            <Link to="/inventory">المخزون</Link> / سجل الحركات
          </>
        }
        actions={
          <ButtonLink to="/inventory/receive" icon="truck">
            استلام بضاعة
          </ButtonLink>
        }
      />
      <div className="row wrap" style={{ gap: 6 }} role="group" aria-label="فلترة الحركات">
        {FILTERS.map((f) => (
          <Chip
            key={f.value}
            selected={filter === f.value}
            onClick={() => {
              setFilter(f.value);
              setPage(1);
            }}
          >
            {f.icon && <Icon name={f.icon} size={16} />} {f.label}
          </Chip>
        ))}
        {productId && (
          <ButtonLink to="/inventory/movements" variant="ghost" size="sm" icon="x">
            كل المنتجات
          </ButtonLink>
        )}
      </div>
      {log.error ? (
        <ErrorState message={errorMessage(log.error)} onRetry={() => void log.refetch()} />
      ) : !log.data ? (
        <PageSkeleton />
      ) : log.data.items.length === 0 ? (
        <EmptyState title="ما في حركات" text="أول ما تستلم بضاعة أو تعدّل المخزون، بتظهر الحركات هون." />
      ) : (
        <div>
          {groupByDay(log.data.items).map((group) => (
            <div key={group.key}>
              <div className="mday">{group.label}</div>
              {group.items.map((m) => (
                <div key={m.id} className={`mrow ${m.onHandDelta > 0 ? "in" : "out"}`} style={{ ["--i" as string]: index++ }}>
                  <span className="mrow__ic">
                    <Icon name={m.onHandDelta > 0 ? "upload" : "package"} />
                  </span>
                  <span>
                    <Link to={`/products/${m.productId}`} style={{ color: "inherit", textDecoration: "none" }}>
                      <b>{m.productName}</b>
                    </Link>
                    {m.variantLabel !== "—" && <span className="caption"> · {m.variantLabel}</span>}
                    <br />
                    <span className="caption">
                      {m.isAutomatic ? "تلقائي · " : ""}
                      {m.referenceKind === "opening" ? "كمية افتتاحية" : m.adjustmentReason ? `تعديل: ${reasonLabel(m.adjustmentReason)}` : "استلام بضاعة"} · {time.format(new Date(m.createdAt))}
                      {m.note && ` · ${m.note}`}
                    </span>
                  </span>
                  <span className="caption">{m.referenceKind === "receipt" ? m.label : ""}</span>
                  <span className="mrow__q ltr">
                    {m.onHandDelta > 0 ? "+" : ""}
                    {m.onHandDelta}
                  </span>
                </div>
              ))}
            </div>
          ))}
          {pages > 1 && (
            <nav className="row" style={{ justifyContent: "center", gap: 12, marginTop: 16 }} aria-label="الصفحات">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                الأحدث
              </Button>
              <span className="caption">
                صفحة <bdi>{page}</bdi> من <bdi>{pages}</bdi>
              </span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                الأقدم
              </Button>
            </nav>
          )}
        </div>
      )}
    </>
  );
}
