import type { StockMovement } from "../api/catalogTypes";
import { Icon } from "@/shared/ui/Icon";

const TYPE_LABEL: Record<StockMovement["type"], string> = {
  receive: "استلام",
  adjustment: "تعديل",
  reserve: "حجز",
  release: "فك حجز",
  sale: "بيع",
  return: "إرجاع",
};

const dateFormat = new Intl.DateTimeFormat("ar-JO-u-nu-latn", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "Asia/Amman" });

/** Latest stock movements of the product (prototype product details `.mrow`). The full log comes in Phase 3. */
export function MovementsCard({ movements }: { movements: readonly StockMovement[] }) {
  return (
    <article className="card">
      <div className="shead">
        <div className="shead__t">
          <span className="overline">آخر الحركات</span>
          <h2>المخزون</h2>
        </div>
      </div>
      {movements.length === 0 ? (
        <p className="muted">ما في حركات.</p>
      ) : (
        movements.map((m, i) => (
          <div key={m.id} className={`mrow ${m.onHandDelta > 0 ? "in" : "out"}`} style={{ ["--i" as string]: i, gridTemplateColumns: "36px minmax(0,1fr) auto", padding: 10 }}>
            <span className="mrow__ic" style={{ width: 36, height: 36 }}>
              <Icon name={m.onHandDelta > 0 ? "upload" : "package"} size={16} />
            </span>
            <span>
              <b style={{ font: "var(--lamma-type-label)" }}>{m.referenceKind === "opening" ? "كمية افتتاحية" : TYPE_LABEL[m.type]}</b>
              <br />
              <span className="caption">
                {dateFormat.format(new Date(m.createdAt))}
                {m.variantLabel !== "—" && ` · ${m.variantLabel}`}
                {m.isAutomatic && " · تلقائي"}
              </span>
            </span>
            <span className="mrow__q ltr">
              {m.onHandDelta > 0 ? "+" : ""}
              {m.onHandDelta}
            </span>
          </div>
        ))
      )}
    </article>
  );
}
