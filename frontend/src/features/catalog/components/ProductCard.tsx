import { Link } from "react-router";
import { formatMoneyNumber, toFils, fromFils } from "@/shared/lib/money";
import { Badge } from "@/shared/ui/Badge";
import { Icon } from "@/shared/ui/Icon";
import { Money } from "@/shared/ui/Money";
import type { ProductListItem } from "../api/catalogTypes";
import { ProductArt, StockMeter } from "./ProductVisuals";

export type ProductCardData = Pick<
  ProductListItem,
  "id" | "name" | "categoryName" | "templateCode" | "imageUrl" | "minPrice" | "maxPrice" | "onHand" | "reserved" | "available" | "lowStockThreshold" | "stockStatus" | "variantCount"
> & { cost?: string; optionLabel?: string };

/** Product card (prototype `App.productCard`). Margin shows only when the cost is known (details/preview). */
export function ProductCard({ product, index = 0, preview, onAdjust }: { product: ProductCardData; index?: number; preview?: boolean; onAdjust?: () => void }) {
  const { stockStatus: status } = product;
  const margin = product.cost !== undefined ? toFils(product.minPrice) - toFils(product.cost) : null;
  const marginPercent = margin !== null && toFils(product.minPrice) > 0 ? Math.round((margin / toFils(product.minPrice)) * 100) : 0;
  const body = (
    <>
      <span className="pcard__cat">
        {product.categoryName ?? "بدون تصنيف"}
        {product.optionLabel && ` · ${product.optionLabel}`}
      </span>
      <span className="pcard__name">{product.name}</span>
      <div className="pcard__price">
        <Money value={product.minPrice} />
        {product.maxPrice !== product.minPrice && (
          <span className="caption">
            {" "}
            – <bdi>{formatMoneyNumber(product.maxPrice)}</bdi>
          </span>
        )}
        {margin !== null && (
          <span className="pcard__margin">
            ربح {formatMoneyNumber(fromFils(margin))} · <bdi>{marginPercent}%</bdi>
          </span>
        )}
      </div>
      <StockMeter onHand={product.onHand} reserved={product.reserved} available={product.available} threshold={product.lowStockThreshold} status={status} />
    </>
  );

  return (
    <div className={`pcard${status === "out" ? " is-out" : status === "low" ? " is-low" : ""}`} style={{ ["--i" as string]: index }}>
      <div className="pcard__stage">
        <ProductArt imageUrl={product.imageUrl} templateCode={product.templateCode} />
        <span className="pcard__ribbon">
          {status === "out" ? (
            <Badge tone="danger">نفد</Badge>
          ) : status === "low" ? (
            <span className="badge badge--attention badge--dot is-live">قرب يخلص</span>
          ) : product.reserved > 0 ? (
            <Badge tone="info">{`${product.reserved} محجوز`}</Badge>
          ) : null}
        </span>
        {!preview && (
          <span className="pcard__actions">
            <Link to={`/products/${product.id}/edit`} aria-label={`تعديل ${product.name}`}>
              <Icon name="pencil" size={16} />
            </Link>
            {onAdjust && (
              <button type="button" aria-label={`تعديل مخزون ${product.name}`} onClick={onAdjust}>
                <Icon name="adjustments" size={16} />
              </button>
            )}
          </span>
        )}
      </div>
      {preview ? (
        <div className="pcard__body">{body}</div>
      ) : (
        <Link className="pcard__body" to={`/products/${product.id}`} style={{ textDecoration: "none", color: "inherit" }}>
          {body}
        </Link>
      )}
    </div>
  );
}
