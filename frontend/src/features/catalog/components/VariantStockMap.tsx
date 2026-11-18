import type { ProductDetails, ProductVariant } from "../api/catalogTypes";
import { COLOR_SWATCHES } from "../domain/catalogDomain";

function HeatCell({ variant, index }: { variant: ProductVariant | undefined; index: number }) {
  if (!variant) {
    return (
      <span className="hcell is-none" style={{ ["--i" as string]: index }}>
        —
      </span>
    );
  }

  const cls = variant.onHand === 0 ? " is-out" : variant.stockStatus === "low" ? " is-low" : "";
  return (
    <span className={`hcell${cls}${variant.reserved ? " is-res" : ""}`} style={{ ["--i" as string]: index }} title={`${variant.label}: موجود ${variant.onHand}، محجوز ${variant.reserved}`}>
      {variant.onHand === 0 ? "نفد" : variant.available}
      <small>{variant.reserved ? `${variant.reserved} محجوز` : "متوفر"}</small>
    </span>
  );
}

/** Stock by variant: a size × colour heatmap for two axes (prototype `.heat`), otherwise one row of cells. */
export function VariantStockMap({ product }: { product: ProductDetails }) {
  const active = product.variants.filter((v) => !v.isArchived && !v.isDefault);
  const [first, second] = product.options;
  if (!first || active.length === 0) {
    const stock = product.variants.find((v) => v.isDefault);
    return (
      <p className="muted">
        المنتج بدون نسخ: <b>{stock?.onHand ?? product.onHand}</b> قطعة بالمخزون.
      </p>
    );
  }

  const find = (a: string, b?: string) => active.find((v) => v.values[0] === a && (b === undefined || v.values[1] === b));
  const rows = second ? second.values : [undefined];
  return (
    <div className="heat" style={{ ["--cols" as string]: first.values.length }}>
      <div className="heat__row" style={{ ["--cols" as string]: first.values.length }}>
        <span />
        {first.values.map((v) => (
          <span key={v} className="vmatrix__h">
            {v}
          </span>
        ))}
      </div>
      {rows.map((row, r) => (
        <div key={row ?? "single"} className="heat__row" style={{ ["--cols" as string]: first.values.length }}>
          <span className="vmatrix__c">
            {row && COLOR_SWATCHES[row] && <i style={{ background: COLOR_SWATCHES[row] }} />}
            {row ?? first.name}
          </span>
          {first.values.map((v, c) => (
            <HeatCell key={v} variant={find(v, row)} index={r * first.values.length + c} />
          ))}
        </div>
      ))}
    </div>
  );
}
