import { Link } from "react-router";
import { errorMessage } from "@/services/api/apiClient";
import { EmptyState } from "@/shared/ui/feedback/EmptyState";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useExpiring } from "../api/inventoryApi";
import { ItemArt } from "../components/InventoryVisuals";
import { expiryLabel } from "../domain/inventoryDomain";

const date = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Expiry dates (prototype `#/inventory/expiry`): one card per variant with stock, nearest first (D-108, D-111). */
export function ExpiryPage() {
  const expiring = useExpiring();
  return (
    <>
      <PageHeader
        title="تواريخ الانتهاء"
        subtitle="للمنتجات اللي إلها تاريخ انتهاء · بننبهك قبل 60 يوم"
        crumbs={
          <>
            <Link to="/inventory">المخزون</Link> / تواريخ الانتهاء
          </>
        }
      />
      {expiring.error ? (
        <ErrorState message={errorMessage(expiring.error)} onRetry={() => void expiring.refetch()} />
      ) : !expiring.data ? (
        <PageSkeleton />
      ) : expiring.data.length === 0 ? (
        <EmptyState title="ما في منتجات بتاريخ انتهاء" text="منتجات قالب التجميل بتسجّل تاريخ الانتهاء عند الإضافة أو الاستلام." />
      ) : (
        <div className="grid g-2">
          {expiring.data.map((item) => {
            const warn = item.status !== "ok";
            const percent = Math.max(4, Math.min(100, (Math.max(item.daysLeft, 0) / 120) * 100));
            return (
              <div key={item.variantId} className="xcard">
                <span className="xring" style={{ ["--p" as string]: percent, ["--c" as string]: warn ? "var(--lamma-apricot-500)" : "var(--lamma-green-500)" }}>
                  <span>
                    <b className="num">{item.daysLeft}</b>يوم
                  </span>
                </span>
                <span className="lowrow__thumb">
                  <ItemArt imageUrl={item.imageUrl} templateCode={item.templateCode} />
                </span>
                <div className="grow">
                  <Link to={`/products/${item.productId}`} style={{ color: "inherit", textDecoration: "none" }}>
                    <b>{item.productName}</b>
                  </Link>
                  <div className="caption">
                    {item.variantLabel !== "—" && `${item.variantLabel} · `}
                    {item.onHand} قطعة · ينتهي {date.format(new Date(`${item.expiryDate}T00:00:00Z`))}
                  </div>
                </div>
                {item.status === "ok" ? (
                  <span className="badge badge--success">{expiryLabel.ok}</span>
                ) : item.status === "soon" ? (
                  <span className="badge badge--attention badge--dot is-live">{expiryLabel.soon}</span>
                ) : (
                  <span className="badge badge--danger">{expiryLabel.expired}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
