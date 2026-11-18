import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Money } from "@/shared/ui/Money";
import type { ProductDetails, ProductVariant } from "../api/catalogTypes";
import { stockStatusLabel, stockStatusTone } from "../domain/catalogDomain";

interface VariantsCardProps {
  product: ProductDetails;
  busyId: string | null;
  onEdit: (variant: ProductVariant) => void;
  onToggleArchived: (variant: ProductVariant) => void;
}

/** Every variant with its price, stock and status; edit overrides, archive or restore (D-100). */
export function VariantsCard({ product, busyId, onEdit, onToggleArchived }: VariantsCardProps) {
  const variants = product.variants.filter((v) => !v.isDefault || !v.isArchived);
  const activeCount = product.variants.filter((v) => !v.isArchived).length;
  return (
    <article className="card">
      <div className="shead">
        <div className="shead__t">
          <span className="overline">السعر والمخزون</span>
          <h2>النسخ</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>النسخة</th>
              <th className="num">السعر</th>
              <th className="num">موجود</th>
              <th className="num hide-sm">محجوز</th>
              <th>الحالة</th>
              <th>
                <span className="sr-only">إجراءات</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.id} className={v.isArchived ? "is-muted" : undefined}>
                <td>
                  <b>{v.isDefault ? "المنتج" : v.label}</b>
                  {v.priceOverride && <span className="caption"> · سعر خاص</span>}
                </td>
                <td className="num">
                  <Money value={v.price} />
                </td>
                <td className="num">{v.onHand}</td>
                <td className="num hide-sm">{v.reserved}</td>
                <td>{v.isArchived ? <Badge tone="outline">مؤرشفة</Badge> : <Badge tone={stockStatusTone[v.stockStatus]}>{stockStatusLabel[v.stockStatus]}</Badge>}</td>
                <td>
                  <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                    {!v.isArchived && (
                      <Button variant="ghost" size="sm" icon="pencil" onClick={() => onEdit(v)} aria-label={`تعديل ${v.label}`}>
                        تعديل
                      </Button>
                    )}
                    {!v.isDefault && (v.isArchived || activeCount > 1) && (
                      <Button variant="ghost" size="sm" loading={busyId === v.id} onClick={() => onToggleArchived(v)} aria-label={`${v.isArchived ? "استرجع" : "أرشف"} ${v.label}`}>
                        {v.isArchived ? "استرجع" : "أرشف"}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
