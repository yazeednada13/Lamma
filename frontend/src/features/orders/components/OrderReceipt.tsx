import { channelLabel, type SalesChannelCode } from "@/features/settings";
import { fromFils, toFils, type MoneyString } from "@/shared/lib/money";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { Icon } from "@/shared/ui/Icon";
import { Money } from "@/shared/ui/Money";
import type { Receipt } from "../domain/orderDomain";
import { linePrice, lineVariant, type Line } from "../domain/orderFormModel";

/** Live receipt of the order form (prototype `#receipt`), computed in fils like the server. */
export function OrderReceipt({ customerName, channel, caption, lines, fee, discount, receipt }: { customerName: string | null; channel: SalesChannelCode | null; caption: string; lines: Line[]; fee: MoneyString; discount: MoneyString; receipt: Receipt }) {
  return (
    <div className="receipt" aria-label="ملخّص الطلب">
      <div className="receipt__head">
        <Illustration kind="parcel" />
        <div>
          <span className="overline">ملخّص الطلب</span>
          <b style={{ display: "block", font: "var(--lamma-type-h3)" }}>{customerName ?? "اختار عميل"}</b>
          <span className="caption">
            {channel ? channelLabel[channel] : "—"} · {caption}
          </span>
        </div>
      </div>
      {lines.map((l) => {
        const v = lineVariant(l);
        return (
          <div key={l.key} className="receipt__row">
            <span>
              {l.product.name}
              {v.isDefault ? "" : ` · ${v.label}`} × {l.quantity}
            </span>
            <Money value={fromFils(l.quantity * toFils(linePrice(l)))} />
          </div>
        );
      })}
      <div className="receipt__row">
        <span>التوصيل</span>
        <Money value={fee} />
      </div>
      {toFils(discount) > 0 && (
        <div className="receipt__row">
          <span>خصم</span>
          <Money value={fromFils(-toFils(discount))} />
        </div>
      )}
      <div className="receipt__total">
        <b>المجموع</b>
        <Money value={receipt.total} />
      </div>
      <div className="receipt__profit">
        <span>
          <Icon name="wallet" size={16} /> ربحك المتوقع
        </span>
        <b>
          <Money value={receipt.profit} />
        </b>
      </div>
      <div className="receipt__barcode" aria-hidden="true" />
    </div>
  );
}
