import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ApiError, api, errorMessage } from "@/services/api/apiClient";
import { formatMoneyNumber, parseMoneyInput, toFils } from "@/shared/lib/money";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { Button, IconButton } from "@/shared/ui/Button";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";
import { PageSkeleton } from "@/shared/ui/feedback/Skeleton";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { TextField } from "@/shared/ui/form/TextField";
import { Icon } from "@/shared/ui/Icon";
import { Money } from "@/shared/ui/Money";
import { PageHeader } from "@/shared/ui/PageHeader";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useInventoryLevels, useReceiveStock, type InventoryLevel } from "../api/inventoryApi";
import { ItemArt } from "../components/InventoryVisuals";
import { receiptTotals, weightedCostPreview } from "../domain/inventoryDomain";

interface Line {
  /** Snapshot of the product when added, so the line keeps its name while the picker is filtered. */
  product: InventoryLevel;
  productId: string;
  variantId: string;
  quantity: number;
  unitCost: string;
  expiryDate: string;
}

const plain = (money: string) => formatMoneyNumber(money).replace(/,/g, "");

/** Templates that carry an expiry date, read from the API (no import of the catalog feature). */
function useExpiryTemplates() {
  return useQuery({
    queryKey: ["inventory", "expiry-templates"],
    queryFn: async () =>
      new Set(
        (await api.get<{ code: string; supportsExpiry: boolean }[]>("/product-templates"))
          .filter((t) => t.supportsExpiry)
          .map((t) => t.code),
      ),
    staleTime: 5 * 60_000,
  });
}

/** Receive goods (prototype `#/inventory/receive`): tiles → lines, supplier and date, live receipt. No purchases expense (D-107). */
export function ReceivePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const levels = useInventoryLevels({ search: search || undefined, pageSize: 100 });
  const expiryTemplates = useExpiryTemplates();
  const receive = useReceiveStock();
  const [lines, setLines] = useState<Line[]>([]);
  const [supplier, setSupplier] = useState("");
  const [receivedOn, setReceivedOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preselected, setPreselected] = useState(false);

  const lineFor = (product: InventoryLevel): Line | null => {
    const variant = product.variants[0];
    return variant
      ? {
          product,
          productId: product.productId,
          variantId: variant.variantId,
          quantity: 1,
          unitCost: plain(variant.cost),
          expiryDate: "",
        }
      : null;
  };
  const add = (product: InventoryLevel) => {
    const line = lineFor(product);
    if (line && !lines.some((l) => l.productId === product.productId)) setLines((ls) => [...ls, line]);
  };

  // `?productId=` preselects a product (from the product details page), once, when the list has loaded.
  const preselect = params.get("productId");
  const preselectProduct = preselect ? levels.data?.items.find((p) => p.productId === preselect) : undefined;
  if (!preselected && preselectProduct) {
    setPreselected(true);
    const line = lineFor(preselectProduct);
    if (line) setLines([line]);
  }

  const update = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const totals = receiptTotals(lines);
  const invalid = lines.some((l) => parseMoneyInput(l.unitCost) === null);

  const submit = async () => {
    setError(null);
    try {
      const receipt = await receive.mutateAsync({
        receivedOn: receivedOn || null,
        supplier: supplier.trim() || null,
        note: null,
        lines: lines.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
          unitCost: parseMoneyInput(l.unitCost)!,
          expiryDate: l.expiryDate || null,
        })),
      });
      toast(`انضافت ${receipt.pieces} قطعة للمخزون`);
      navigate("/inventory");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : errorMessage(e));
    }
  };

  if (levels.error || expiryTemplates.error) {
    return (
      <ErrorState
        message={errorMessage(levels.error ?? expiryTemplates.error)}
        onRetry={() => void Promise.all([levels.refetch(), expiryTemplates.refetch()])}
      />
    );
  }

  if (!levels.data || !expiryTemplates.data) return <PageSkeleton />;

  return (
    <>
      <PageHeader
        title="استلام بضاعة"
        subtitle="سجّل اللي وصلك من المورّد — المخزون بيزيد فورًا"
        crumbs={
          <>
            <Link to="/inventory">المخزون</Link> / استلام بضاعة
          </>
        }
      />
      <div className="grid g-main" style={{ gap: 20 }}>
        <div className="col" style={{ gap: 16 }}>
          <section className="card osec" aria-labelledby="rc-what">
            <div className="osec__h">
              <span className="osec__n">1</span>
              <h2 id="rc-what">شو وصلك؟</h2>
              <span className="caption end">اضغط على منتج لتضيفه</span>
            </div>
            <span className="control control--search" style={{ height: 40, maxWidth: 280, marginBottom: 10 }}>
              <Icon name="search" />
              <input
                placeholder="ابحث عن منتج"
                aria-label="ابحث عن منتج"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </span>
            <div className="picker">
              {levels.data.items.map((p) => (
                <button
                  key={p.productId}
                  type="button"
                  className={`ptile${lines.some((l) => l.productId === p.productId) ? " is-added" : ""}`}
                  onClick={() => add(p)}
                  aria-label={`أضف ${p.name}`}
                >
                  <ItemArt imageUrl={p.imageUrl} templateCode={p.templateCode} />
                  <b>{p.name}</b>
                  <small>موجود {p.onHand}</small>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 6 }}>
              {lines.length === 0 && <p className="muted">اختار منتج من فوق.</p>}
              {lines.map((line, i) => {
                const product = line.product;
                const named = product.variants.filter((v) => v.label !== "—");
                const costBad = parseMoneyInput(line.unitCost) === null;
                const variant = product.variants.find((v) => v.variantId === line.variantId);
                const typed = parseMoneyInput(line.unitCost);
                const after = variant
                  ? weightedCostPreview(variant.onHand, variant.cost, line.quantity, line.unitCost)
                  : null;
                const changed = variant && typed !== null && after !== null && toFils(typed) !== toFils(variant.cost);
                return (
                  <div key={line.productId} className="line2">
                    <span className="line2__art">
                      <ItemArt imageUrl={product.imageUrl} templateCode={product.templateCode} />
                    </span>
                    <div className="col" style={{ gap: 6, minWidth: 0 }}>
                      <b>{product.name}</b>
                      {named.length > 0 && (
                        <span className="control" style={{ height: 34, maxWidth: 200 }}>
                          <select
                            aria-label={`نسخة ${product.name}`}
                            value={line.variantId}
                            onChange={(e) =>
                              update(i, {
                                variantId: e.target.value,
                                unitCost: plain(product.variants.find((v) => v.variantId === e.target.value)!.cost),
                              })
                            }
                          >
                            {named.map((v) => (
                              <option key={v.variantId} value={v.variantId}>
                                {v.label}
                              </option>
                            ))}
                          </select>
                        </span>
                      )}
                      {expiryTemplates.data.has(product.templateCode) && (
                        <span className="control" style={{ height: 34, maxWidth: 200 }}>
                          <input
                            type="date"
                            className="ltr"
                            aria-label={`تاريخ انتهاء ${product.name}`}
                            value={line.expiryDate}
                            onChange={(e) => update(i, { expiryDate: e.target.value })}
                          />
                        </span>
                      )}
                      {changed && variant && (
                        // D-109: show what the new purchase cost does to the product's cost before confirming.
                        <span className="caption" role="status">
                          {variant.onHand > 0 ? (
                            <>
                              التكلفة الحالية <bdi>{formatMoneyNumber(variant.cost)}</bdi> ← بعد الاستلام بتصير{" "}
                              <b>
                                <bdi>{formatMoneyNumber(after)}</bdi>
                              </b>{" "}
                              د.أ (متوسط مع الـ <bdi>{variant.onHand}</bdi> قطعة الموجودة)
                            </>
                          ) : (
                            <>
                              ما في مخزون حالي، فتكلفة القطعة بتصير{" "}
                              <b>
                                <bdi>{formatMoneyNumber(after)}</bdi>
                              </b>{" "}
                              د.أ
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="col" style={{ gap: 4 }}>
                      <span className="caption" id={`rc-qty-${line.productId}`}>
                        الكمية اللي وصلت
                      </span>
                      <span className="stepper">
                        <button
                          type="button"
                          aria-label={`زيادة ${product.name}`}
                          onClick={() => update(i, { quantity: Math.min(line.quantity + 1, 100_000) })}
                        >
                          +
                        </button>
                        <input
                          className="ltr"
                          aria-label={`كمية ${product.name}`}
                          inputMode="numeric"
                          value={line.quantity}
                          onChange={(e) =>
                            update(i, {
                              quantity: Math.max(1, Math.min(100_000, Number.parseInt(e.target.value, 10) || 1)),
                            })
                          }
                        />
                        <button
                          type="button"
                          aria-label={`نقص ${product.name}`}
                          onClick={() => update(i, { quantity: Math.max(1, line.quantity - 1) })}
                        >
                          −
                        </button>
                      </span>
                    </div>
                    <div className="col" style={{ gap: 4 }}>
                      <span className="caption" title="بقديش اشتريت القطعة من المورّد بهالشحنة. مش سعر البيع.">
                        تكلفة القطعة (سعر الشراء)
                      </span>
                      <span className={`control${costBad ? " is-error" : ""}`} style={{ height: 36, width: 110 }}>
                        <input
                          className="ltr"
                          inputMode="decimal"
                          aria-label={`تكلفة القطعة (سعر الشراء) ${product.name}`}
                          aria-invalid={costBad || undefined}
                          value={line.unitCost}
                          onChange={(e) => update(i, { unitCost: e.target.value })}
                        />
                        <span className="control__affix">د.أ</span>
                      </span>
                    </div>
                    <IconButton
                      icon="x"
                      size="sm"
                      label={`شيل ${product.name}`}
                      onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    />
                  </div>
                );
              })}
            </div>
          </section>
          <section className="card osec" aria-labelledby="rc-supplier">
            <div className="osec__h">
              <span className="osec__n">2</span>
              <h2 id="rc-supplier">المورّد</h2>
            </div>
            <div className="grid g-2">
              <TextField
                label="المورّد"
                icon="truck"
                maxLength={100}
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              />
              <TextField
                label="التاريخ"
                icon="calendar"
                type="date"
                ltr
                help="فاضي = اليوم"
                value={receivedOn}
                onChange={(e) => setReceivedOn(e.target.value)}
              />
            </div>
          </section>
        </div>
        <aside className="receipt-wrap">
          <div className="receipt" aria-live="polite">
            <div className="receipt__head">
              <Illustration kind="parcel" />
              <div>
                <span className="overline">إيصال استلام</span>
                <b style={{ display: "block", font: "var(--lamma-type-h3)" }}>{supplier.trim() || "مورّد"}</b>
                <span className="caption">{receivedOn || "اليوم"}</span>
              </div>
            </div>
            {lines.map((l) => {
              const product = l.product;
              const variant = product.variants.find((v) => v.variantId === l.variantId);
              const cost = parseMoneyInput(l.unitCost);
              return (
                <div key={l.productId} className="receipt__row">
                  <span>
                    {product.name}
                    {variant && variant.label !== "—" ? ` · ${variant.label}` : ""} × {l.quantity}
                    {cost !== null && (
                      <span className="caption">
                        {" "}
                        بـ <bdi>{formatMoneyNumber(cost)}</bdi>
                      </span>
                    )}
                  </span>
                  {cost !== null ? <Money value={receiptTotals([l]).total} /> : "—"}
                </div>
              );
            })}
            <div className="receipt__total">
              <b>{totals.pieces} قطعة</b>
              <Money value={totals.total} />
            </div>
            <div className="receipt__barcode" aria-hidden="true" />
          </div>
          {error && <FormAlert>{error}</FormAlert>}
          <Button
            size="lg"
            icon="check"
            loading={receive.isPending}
            disabled={lines.length === 0 || invalid}
            onClick={() => void submit()}
          >
            تأكيد الاستلام
          </Button>
        </aside>
      </div>
    </>
  );
}
