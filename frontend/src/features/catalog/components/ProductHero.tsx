import { Badge } from "@/shared/ui/Badge";
import { Donut } from "@/shared/ui/charts/Donut";
import { Money } from "@/shared/ui/Money";
import type { ProductDetails, ProductTemplate } from "../api/catalogTypes";
import { ProductArt } from "./ProductVisuals";

/** Hero: picture, status chips, price, margin per piece and the stock donut (prototype `.phero`). */
export function ProductHero({ product, template }: { product: ProductDetails; template?: ProductTemplate }) {
  const available = Math.max(product.available, 0);
  const sizes = product.options[0];
  const colors = product.options[1];
  const expiry = product.variants.find((v) => !v.isArchived && v.expiryDate)?.expiryDate;
  return (
    <section className="phero">
      <div className="phero__stage">
        <ProductArt imageUrl={product.imageUrl} templateCode={product.templateCode} />
      </div>
      <div>
        <span className="overline">
          {product.categoryName ?? "بدون تصنيف"} · قالب {template?.nameAr ?? "عام"}
        </span>
        <h1>{product.name}</h1>
        <div className="phero__chips">
          {product.isArchived ? (
            <Badge tone="outline" large>
              مؤرشف
            </Badge>
          ) : product.stockStatus === "out" ? (
            <Badge tone="danger" large>
              نفد
            </Badge>
          ) : product.stockStatus === "low" ? (
            <span className="badge badge--attention badge--dot badge--lg is-live">قرب يخلص</span>
          ) : (
            <Badge tone="success" large>
              متوفر
            </Badge>
          )}
          {sizes && <Badge large>{`${sizes.values.length} ${sizes.name}`}</Badge>}
          {colors && <Badge large>{`${colors.values.length} ${colors.name}`}</Badge>}
          {expiry && (
            <Badge tone="info" large>
              ينتهي <bdi>{expiry}</bdi>
            </Badge>
          )}
        </div>
        <div className="phero__nums">
          <div>
            <span>السعر</span>
            <b>
              <Money value={product.minPrice} />
            </b>
          </div>
          <div>
            <span>الربح بالقطعة</span>
            <b style={{ color: "var(--lamma-green-700)" }}>
              <Money value={product.marginPerUnit} /> · <bdi>{Math.round(product.marginPercent)}%</bdi>
            </b>
          </div>
          <div>
            <span>انباع لهلّق</span>
            <b className="num">—</b>
          </div>
        </div>
      </div>
      <div className="phero__stock">
        <Donut
          segments={[
            { label: "متوفر", value: available, color: product.stockStatus === "in" ? "var(--lamma-green-500)" : "var(--lamma-apricot-500)" },
            { label: "محجوز", value: product.reserved, color: "var(--lamma-blue-500)" },
          ]}
          center={<bdi>{available}</bdi>}
          sub="متوفر"
        />
        <span className="caption">
          {product.onHand} موجود · {product.reserved} محجوز · الحد {product.lowStockThreshold}
        </span>
      </div>
    </section>
  );
}
