import { Link } from "react-router";
import { formatMoneyNumber } from "@/shared/lib/money";
import { ButtonLink, Button } from "@/shared/ui/Button";
import { Illustration } from "@/shared/ui/brand/Illustration";
import type { InventoryLevel, InventorySummary } from "../api/inventoryApi";

/** Product picture: uploaded image or the template illustration. */
export function ItemArt({ imageUrl, templateCode }: { imageUrl: string | null; templateCode: string }) {
  return imageUrl ? <img className="product-img" src={imageUrl} alt="" loading="lazy" /> : <Illustration kind="product" template={templateCode} />;
}

/** Dark summary band (prototype `.invhero`): stock value, reserved, low and out (D-113). */
export function InventoryHero({ summary }: { summary: InventorySummary }) {
  return (
    <section className="invhero" aria-label="ملخص المخزون">
      <div>
        <span className="overline">قيمة المخزون</span>
        <b>
          <bdi>{formatMoneyNumber(summary.stockValueAtCost)}</bdi> <small style={{ font: "var(--lamma-type-label)" }}>د.أ</small>
        </b>
        <span>{summary.pieces} قطعة بالتكلفة</span>
      </div>
      <div>
        <span className="overline">محجوز لطلبات</span>
        <b className="num">{summary.reserved}</b>
        <span>بينخصم عند التوصيل</span>
      </div>
      <div className="hot">
        <span className="overline">قرب يخلص</span>
        <b className="num">{summary.lowCount}</b>
        <span>{summary.lowNames.join("، ") || "—"}</span>
      </div>
      <div>
        <span className="overline">نفد</span>
        <b className="num">{summary.outCount}</b>
        <span>{summary.outNames.join("، ") || "—"}</span>
      </div>
    </section>
  );
}

/** One product's stock (prototype `stockRow`): art, name, stock meter, threshold, receive and adjust actions. */
export function StockRow({ level, onAdjust }: { level: InventoryLevel; onAdjust: (level: InventoryLevel) => void }) {
  const max = Math.max(level.onHand, level.lowStockThreshold * 4, 1);
  const cls = level.stockStatus === "out" ? " stock--out" : level.stockStatus === "low" ? " stock--low" : "";
  const variants = level.variants.filter((v) => v.label !== "—");
  return (
    <div className="srow">
      <span className="srow__art">
        <ItemArt imageUrl={level.imageUrl} templateCode={level.templateCode} />
      </span>
      <div>
        <Link to={`/products/${level.productId}`} style={{ color: "inherit", textDecoration: "none" }}>
          <b>{level.name}</b>
        </Link>
        <br />
        <span className="caption">
          {level.categoryName ?? "بدون تصنيف"}
          {variants.length > 0 && ` · ${variants.map((v) => `${v.label}: ${v.available}`).join("، ")}`}
        </span>
      </div>
      <div className={`stock${cls}`}>
        <div className="stock__bar" aria-hidden="true">
          <span className="stock__avail" style={{ width: `${(Math.max(level.available, 0) / max) * 100}%` }} />
          <span className="stock__res" style={{ width: `${(level.reserved / max) * 100}%` }} />
        </div>
        <span className="stock__txt">
          {level.stockStatus === "out" ? <b>نفد</b> : <><b>{level.available}</b> متوفر{level.stockStatus === "low" && " · قرب يخلص"}</>}
          {level.reserved > 0 && ` · ${level.reserved} محجوز`}
        </span>
      </div>
      <span className="caption">الحد {level.lowStockThreshold}</span>
      <span className="srow__acts">
        <ButtonLink to={`/inventory/receive?productId=${level.productId}`} variant="secondary" size="sm" className="icon-btn" aria-label={`استلام ${level.name}`} icon="truck">
          <span className="sr-only">استلام</span>
        </ButtonLink>
        <Button variant="outline" size="sm" onClick={() => onAdjust(level)} aria-label={`تعديل مخزون ${level.name}`}>
          تعديل
        </Button>
      </span>
    </div>
  );
}
