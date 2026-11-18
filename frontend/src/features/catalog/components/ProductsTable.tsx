import { Link, useNavigate } from "react-router";
import { Money } from "@/shared/ui/Money";
import type { ProductListItem } from "../api/catalogTypes";
import { ProductArt, StockMeter } from "./ProductVisuals";

/** Table view of the products list (prototype `#/products` list mode). */
export function ProductsTable({ products }: { products: readonly ProductListItem[] }) {
  const navigate = useNavigate();
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>المنتج</th>
            <th className="hide-sm">التصنيف</th>
            <th>المخزون</th>
            <th className="num">السعر</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} onClick={() => navigate(`/products/${p.id}`)} style={{ cursor: "pointer" }}>
              <td>
                <div className="cell-product">
                  <span className="lowrow__thumb" style={{ width: 40, height: 40 }}>
                    <ProductArt imageUrl={p.imageUrl} templateCode={p.templateCode} />
                  </span>
                  <Link to={`/products/${p.id}`} onClick={(event) => event.stopPropagation()} style={{ color: "inherit", textDecoration: "none" }}>
                    <b>{p.name}</b>
                  </Link>
                </div>
              </td>
              <td className="hide-sm">{p.categoryName ?? "بدون تصنيف"}</td>
              <td>
                <StockMeter onHand={p.onHand} reserved={p.reserved} available={p.available} threshold={p.lowStockThreshold} status={p.stockStatus} />
              </td>
              <td className="num">
                <Money value={p.minPrice} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
