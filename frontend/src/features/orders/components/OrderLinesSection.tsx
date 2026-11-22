import { useState } from "react";
import { formatMoneyNumber, fromFils, toFils } from "@/shared/lib/money";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { Icon } from "@/shared/ui/Icon";
import { Money } from "@/shared/ui/Money";
import { useProductOptions } from "../api/ordersApi";
import { clampQuantity, productArt } from "../domain/orderDomain";
import { linePrice, lineVariant, type Line } from "../domain/orderFormModel";
import { ItemThumb } from "./OrderBits";

interface Props {
  done: boolean;
  lines: Line[];
  loadingProductId: string | null;
  onAdd: (productId: string) => void;
  onChange: (key: string, patch: Partial<Line>) => void;
  onRemove: (key: string) => void;
}

/** Step 2: product picker and lines (variant swatches, quantity capped at the available stock). */
export function OrderLinesSection({
  done,
  lines,
  loadingProductId,
  onAdd,
  onChange,
  onRemove,
  preOrder = false,
}: Props & { preOrder?: boolean }) {
  const [search, setSearch] = useState("");
  const options = useProductOptions(search.trim());

  return (
    <section className={`card osec${done ? " is-done" : ""}`} id="s2" aria-labelledby="s2-title">
      <div className="osec__h">
        <span className="osec__n">2</span>
        <h2 id="s2-title">المنتجات</h2>
        <span className="caption end">اضغط على منتج لتضيفه</span>
      </div>
      <span className="control" style={{ marginBottom: 12 }}>
        <Icon name="search" />
        <input
          placeholder="دوّر على منتج…"
          aria-label="دوّر على منتج"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </span>
      <div className="picker">
        {(options.data?.items ?? []).map((p) => {
          const out = p.available <= 0 && !preOrder;
          return (
            <button
              key={p.id}
              type="button"
              className={`ptile${lines.some((l) => l.product.id === p.id) ? " is-added" : ""}${out ? " is-out" : ""}`}
              aria-disabled={out || undefined}
              disabled={loadingProductId === p.id}
              onClick={() => !out && onAdd(p.id)}
            >
              {p.imageUrl ? (
                <img src={p.imageUrl} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 12 }} />
              ) : (
                <Illustration kind="product" template={productArt(p.templateCode)} />
              )}
              <b>{p.name}</b>
              <small>
                {out
                  ? "نفد"
                  : p.available <= 0
                    ? `${formatMoneyNumber(p.minPrice)} د.أ · مسبق`
                    : `${formatMoneyNumber(p.minPrice)} د.أ · ${p.available} متوفر`}
              </small>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 6 }}>
        {lines.length === 0 ? (
          <p className="muted" style={{ padding: "12px 0" }}>
            لسا ما ضفت منتجات.
          </p>
        ) : (
          lines.map((l) => (
            <LineRow
              key={l.key}
              line={l}
              preOrder={preOrder}
              taken={lines.filter((x) => x.key !== l.key).map((x) => x.variantId)}
              onChange={onChange}
              onRemove={onRemove}
            />
          ))
        )}
      </div>
    </section>
  );
}

function LineRow({
  line,
  taken,
  onChange,
  onRemove,
  preOrder,
}: {
  line: Line;
  taken: string[];
  onChange: Props["onChange"];
  onRemove: Props["onRemove"];
  preOrder: boolean;
}) {
  const v = lineVariant(line);
  const over = line.quantity > v.available;
  const cap = preOrder ? 1000 : v.available; // D-151: a pre-order saved «جديد» may wait for stock
  return (
    <div className="line2">
      <span className="line2__art">
        {line.product.imageUrl ? (
          <ItemThumb imageUrl={line.product.imageUrl} size={56} />
        ) : (
          <Illustration kind="product" template={productArt(line.product.templateCode)} />
        )}
      </span>
      <div className="col" style={{ gap: 6, minWidth: 0 }}>
        <b>{line.product.name}</b>
        {!v.isDefault && (
          <div className="row wrap" style={{ gap: 6 }} role="radiogroup" aria-label={`نسخة ${line.product.name}`}>
            {line.variants.map((x) => {
              const blocked = (x.available <= 0 && !preOrder) || taken.includes(x.id);
              return (
                <button
                  key={x.id}
                  type="button"
                  role="radio"
                  aria-checked={x.id === line.variantId}
                  className={`swatch${x.id === line.variantId ? " is-selected" : ""}${blocked ? " is-out" : ""}`}
                  title={x.available <= 0 ? "نفد" : taken.includes(x.id) ? "مضافة بسطر ثاني" : undefined}
                  onClick={() =>
                    !blocked &&
                    onChange(line.key, {
                      variantId: x.id,
                      unitPrice: undefined,
                      quantity: clampQuantity(line.quantity, preOrder ? 1000 : x.available),
                    })
                  }
                >
                  {x.label}
                </button>
              );
            })}
          </div>
        )}
        <span className={over && !preOrder ? "field__error" : "caption"}>
          {over && preOrder ? (
            `متوفر ${v.available} · الباقي بيستنى البضاعة (طلب مسبق)`
          ) : over ? (
            <>
              <Icon name="alert-triangle" size={16} /> متوفر {v.available} بس{v.isDefault ? "" : ` من ${v.label}`}
            </>
          ) : (
            `متوفر ${v.available}`
          )}
        </span>
      </div>
      <span className="stepper">
        <button
          type="button"
          aria-label="زيادة"
          disabled={line.quantity >= cap}
          onClick={() => onChange(line.key, { quantity: line.quantity + 1 })}
        >
          +
        </button>
        <input className="ltr" value={line.quantity} aria-label={`كمية ${line.product.name}`} readOnly />
        <button
          type="button"
          aria-label="نقص"
          disabled={line.quantity <= 1}
          onClick={() => onChange(line.key, { quantity: Math.max(1, line.quantity - 1) })}
        >
          −
        </button>
      </span>
      <Money value={fromFils(line.quantity * toFils(linePrice(line)))} />
      <button
        type="button"
        className="btn btn--ghost icon-btn btn--sm"
        aria-label={`حذف ${line.product.name}`}
        onClick={() => onRemove(line.key)}
      >
        <Icon name="trash" size={16} />
      </button>
    </div>
  );
}
