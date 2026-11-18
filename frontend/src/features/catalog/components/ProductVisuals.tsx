import { Illustration } from "@/shared/ui/brand/Illustration";
import type { StockStatusCode } from "../api/catalogTypes";
import { templateArt } from "../domain/catalogDomain";

/** Product picture: the uploaded image, or the template illustration (prototype `.pcard__stage`). */
export function ProductArt({ imageUrl, templateCode }: { imageUrl: string | null; templateCode: string }) {
  return imageUrl ? <img className="product-img" src={imageUrl} alt="" loading="lazy" /> : <Illustration kind="product" template={templateArt(templateCode)} />;
}

/** Stock bar with available and reserved parts (prototype `App.stockMeter`). */
export function StockMeter({ onHand, reserved, available, threshold, status }: { onHand: number; reserved: number; available: number; threshold: number; status: StockStatusCode }) {
  const max = Math.max(onHand, threshold * 4, 1);
  const cls = status === "out" ? " stock--out" : status === "low" ? " stock--low" : "";
  return (
    <div className={`stock${cls}`}>
      <div className="stock__bar" aria-hidden="true">
        <span className="stock__avail" style={{ width: `${(Math.max(available, 0) / max) * 100}%` }} />
        <span className="stock__res" style={{ width: `${(reserved / max) * 100}%` }} />
      </div>
      <span className="stock__txt">
        {status === "out" ? (
          <b>نفد</b>
        ) : (
          <>
            <b>{available}</b> متوفر{status === "low" && " · قرب يخلص"}
          </>
        )}
        {reserved > 0 && ` · ${reserved} محجوز`}
      </span>
    </div>
  );
}
