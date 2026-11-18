// TEST-ONLY MSW handlers for the catalog contracts (API-DESIGN §12). State lives on each fake business,
// so it is cleared with fake.reset(). Never bundled into the app.
import { http, HttpResponse, type JsonBodyType } from "msw";

type Json = Record<string, unknown>;
type StockStatus = "in" | "low" | "out";

export interface FakeVariant {
  id: string;
  values: string[];
  priceOverride: string | null;
  costOverride: string | null;
  onHand: number;
  reserved: number;
  expiryDate: string | null;
  isArchived: boolean;
}

export interface FakeProduct {
  id: string;
  name: string;
  categoryId: string | null;
  templateCode: string;
  sellingPrice: string;
  cost: string;
  lowStockThreshold: number;
  attributes: Record<string, string>;
  optionNames: string[];
  variants: FakeVariant[];
  imageUrl: string | null;
  isArchived: boolean;
  movements: { id: string; variantId: string; onHandDelta: number; createdAt: string }[];
  createdAt: string;
}

export interface FakeCatalog {
  categories: { id: string; name: string; isArchived: boolean }[];
  products: FakeProduct[];
  customFields: Record<string, { key: string; labelAr: string; type: string; options: string[]; isRequired: boolean; isCustom: true }[]>;
}

export const newCatalog = (): FakeCatalog => ({ categories: [], products: [], customFields: {} });

const field = (key: string, labelAr: string, type = "text", options: string[] = []) => ({ key, labelAr, type, options, isRequired: false, isCustom: false });

export const TEMPLATES = [
  {
    code: "clothing",
    nameAr: "ملابس",
    supportsExpiry: false,
    supportsGiftBox: false,
    defaultAxes: [
      { name: "المقاس", suggestedValues: ["XS", "S", "M", "L", "XL", "XXL"] },
      { name: "اللون", suggestedValues: ["زيتي", "كريمي", "طوبي", "أسود", "سماوي"] },
    ],
    fields: [field("fabric", "الخامة"), field("gender", "الفئة", "select", ["نسائي", "رجالي", "أطفال", "للجنسين"]), field("cut", "القصّة")],
  },
  { code: "perfume", nameAr: "عطور", supportsExpiry: false, supportsGiftBox: false, defaultAxes: [{ name: "الحجم", suggestedValues: ["10 مل", "50 مل", "100 مل"] }], fields: [] },
  { code: "beauty", nameAr: "تجميل", supportsExpiry: true, supportsGiftBox: false, defaultAxes: [{ name: "الدرجة", suggestedValues: [] }], fields: [] },
  { code: "jewelry", nameAr: "إكسسوارات", supportsExpiry: false, supportsGiftBox: false, defaultAxes: [], fields: [field("material", "الخامة"), field("weight", "الوزن بالغرام", "number")] },
  { code: "gift", nameAr: "بوكس هدايا", supportsExpiry: false, supportsGiftBox: true, defaultAxes: [], fields: [field("contents", "المكوّنات")] },
  { code: "other", nameAr: "عام", supportsExpiry: false, supportsGiftBox: false, defaultAxes: [], fields: [] },
];

let seq = 1;
const nextId = (prefix: string) => `${prefix}${seq++}`;
const money3 = (v: string) => Number(v).toFixed(3);
const status = (available: number, threshold: number): StockStatus => (available <= 0 ? "out" : available <= threshold ? "low" : "in");

function details(catalog: FakeCatalog, p: FakeProduct) {
  const active = p.variants.filter((v) => !v.isArchived);
  const onHand = active.reduce((s, v) => s + v.onHand, 0);
  const reserved = active.reduce((s, v) => s + v.reserved, 0);
  const prices = active.map((v) => Number(v.priceOverride ?? p.sellingPrice));
  const margin = Number(p.sellingPrice) - Number(p.cost);
  const label = (v: FakeVariant) => (v.values.length ? v.values.join(" · ") : "—");
  return {
    id: p.id,
    name: p.name,
    categoryId: p.categoryId,
    categoryName: catalog.categories.find((c) => c.id === p.categoryId)?.name ?? null,
    templateCode: p.templateCode,
    imageUrl: p.imageUrl,
    sellingPrice: money3(p.sellingPrice),
    cost: money3(p.cost),
    marginPerUnit: margin.toFixed(3),
    marginPercent: Math.round((margin / Number(p.sellingPrice)) * 1000) / 10,
    minPrice: Math.min(...prices).toFixed(3),
    maxPrice: Math.max(...prices).toFixed(3),
    lowStockThreshold: p.lowStockThreshold,
    onHand,
    reserved,
    available: onHand - reserved,
    stockStatus: status(onHand - reserved, p.lowStockThreshold),
    variantCount: active.filter((v) => v.values.length > 0).length,
    isArchived: p.isArchived,
    attributes: p.attributes,
    options: p.optionNames.map((name, i) => ({ name, values: [...new Set(active.filter((v) => v.values.length).map((v) => v.values[i]!))] })),
    variants: [...p.variants]
      .sort((a, b) => Number(a.isArchived) - Number(b.isArchived))
      .map((v) => ({
        id: v.id,
        values: v.values,
        label: label(v),
        price: money3(v.priceOverride ?? p.sellingPrice),
        cost: money3(v.costOverride ?? p.cost),
        priceOverride: v.priceOverride ? money3(v.priceOverride) : null,
        costOverride: v.costOverride ? money3(v.costOverride) : null,
        onHand: v.onHand,
        reserved: v.reserved,
        available: v.onHand - v.reserved,
        stockStatus: status(v.onHand - v.reserved, 1),
        expiryDate: v.expiryDate,
        isArchived: v.isArchived,
        isDefault: v.values.length === 0,
      })),
    recentMovements: [...p.movements].reverse().slice(0, 10).map((m) => ({
      id: m.id,
      variantId: m.variantId,
      variantLabel: label(p.variants.find((v) => v.id === m.variantId)!),
      type: "receive",
      referenceKind: "opening",
      label: "كمية افتتاحية",
      onHandDelta: m.onHandDelta,
      reservedDelta: 0,
      unitCost: money3(p.cost),
      isAutomatic: true,
      createdAt: m.createdAt,
    })),
    createdAt: p.createdAt,
    updatedAt: p.createdAt,
  };
}

interface Deps {
  base: string;
  withBusiness: (handler: (business: { catalog: FakeCatalog }, body: Json, request: Request, params: Record<string, string>) => Response) => Parameters<typeof http.get>[1];
  problem: (status: number, code: string, detail: string, errors?: Record<string, string[]>) => Response;
  json: (data: JsonBodyType, status?: number) => Response;
}

function addVariant(p: FakeProduct, values: string[], qty: number, extra: Partial<FakeVariant> = {}): FakeVariant {
  const variant: FakeVariant = { id: nextId("v"), values, priceOverride: null, costOverride: null, onHand: qty, reserved: 0, expiryDate: null, isArchived: false, ...extra };
  p.variants.push(variant);
  if (qty > 0) p.movements.push({ id: nextId("m"), variantId: variant.id, onHandDelta: qty, createdAt: "2026-11-17T09:00:00Z" });
  return variant;
}

export function createCatalogHandlers({ base, withBusiness, problem, json }: Deps) {
  const find = (catalog: FakeCatalog, id: string) => catalog.products.find((p) => p.id === id);
  const notFound = () => problem(404, "product.not_found", "ما لقينا المنتج.");

  return [
    http.get(`${base}/categories`, withBusiness(({ catalog }) =>
      json(catalog.categories.filter((c) => !c.isArchived).map((c) => ({ id: c.id, name: c.name, productCount: catalog.products.filter((p) => p.categoryId === c.id && !p.isArchived).length }))),
    )),
    http.post(`${base}/categories`, withBusiness(({ catalog }, body) => {
      const name = String(body.name ?? "").trim();
      if (catalog.categories.some((c) => !c.isArchived && c.name === name)) return problem(409, "category.duplicate_name", "في تصنيف بنفس الاسم.");
      const category = { id: nextId("c"), name, isArchived: false };
      catalog.categories.push(category);
      return json({ id: category.id, name, productCount: 0 }, 201);
    })),
    http.put(`${base}/categories/:id`, withBusiness(({ catalog }, body, _r, params) => {
      const category = catalog.categories.find((c) => c.id === params.id && !c.isArchived);
      if (!category) return problem(404, "category.not_found", "ما لقينا التصنيف.");
      category.name = String(body.name).trim();
      return json({ id: category.id, name: category.name, productCount: 0 });
    })),
    http.delete(`${base}/categories/:id`, withBusiness(({ catalog }, _b, _r, params) => {
      const active = catalog.products.filter((p) => p.categoryId === params.id && !p.isArchived).length;
      if (active > 0) return problem(409, "category.has_products", `التصنيف فيه ${active} منتج. انقل المنتجات لتصنيف ثاني أو أرشفها قبل ما تحذفه.`);
      catalog.categories = catalog.categories.filter((c) => c.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    })),

    http.get(`${base}/product-templates`, withBusiness(({ catalog }) => json(TEMPLATES.map((t) => ({ ...t, fields: [...t.fields, ...(catalog.customFields[t.code] ?? [])] }))))),
    http.post(`${base}/product-templates/:code/fields`, withBusiness(({ catalog }, body, _r, params) => {
      const code = params.code!;
      const list = (catalog.customFields[code] ??= []);
      const template = TEMPLATES.find((t) => t.code === code)!;
      if ([...template.fields, ...list].some((f) => f.labelAr === body.labelAr)) return problem(409, "template.duplicate_field_label", "في حقل بنفس الاسم بهذا القالب.");
      const created = { key: `c_${String(seq++).padStart(8, "0")}`, labelAr: String(body.labelAr), type: String(body.type), options: (body.options as string[]) ?? [], isRequired: Boolean(body.isRequired), isCustom: true as const };
      list.push(created);
      return json(created, 201);
    })),
    http.delete(`${base}/product-templates/:code/fields/:key`, withBusiness(({ catalog }, _b, _r, params) => {
      catalog.customFields[params.code!] = (catalog.customFields[params.code!] ?? []).filter((f) => f.key !== params.key);
      return new HttpResponse(null, { status: 204 });
    })),

    http.get(`${base}/products`, withBusiness(({ catalog }, _b, request) => {
      const q = new URL(request.url).searchParams;
      const archived = q.get("archived") === "true";
      const page = Number(q.get("page") ?? 1);
      const pageSize = Number(q.get("pageSize") ?? 20);
      let rows = catalog.products.filter((p) => p.isArchived === archived).map((p) => details(catalog, p));
      if (q.get("search")) rows = rows.filter((r) => r.name.includes(q.get("search")!));
      if (q.get("uncategorized") === "true") rows = rows.filter((r) => r.categoryId === null);
      else if (q.get("categoryId")) rows = rows.filter((r) => r.categoryId === q.get("categoryId"));
      if (q.get("stockStatus")) rows = rows.filter((r) => r.stockStatus === q.get("stockStatus"));
      const items = rows.slice((page - 1) * pageSize, page * pageSize).map(({ sellingPrice: _s, cost: _c, marginPerUnit: _m, marginPercent: _p, attributes: _a, options: _o, variants: _v, recentMovements: _r, updatedAt: _u, ...item }) => item);
      return json({ items, page, pageSize, totalCount: rows.length });
    })),
    http.post(`${base}/products`, withBusiness(({ catalog }, body) => {
      if (Number(body.sellingPrice) <= 0) return problem(422, "validation.failed", "x", { sellingPrice: ["السعر لازم يكون أكبر من صفر."] });
      const attributes = (body.attributes as Record<string, string>) ?? {};
      if (attributes.engine) return problem(422, "validation.failed", "x", { "attributes.engine": ["هذا الحقل مش موجود بقالب المنتج."] });
      const options = (body.options as { name: string; values: string[] }[]) ?? [];
      const product: FakeProduct = {
        id: nextId("p"),
        name: String(body.name),
        categoryId: (body.categoryId as string | null) ?? null,
        templateCode: String(body.templateCode ?? "clothing"),
        sellingPrice: String(body.sellingPrice),
        cost: String(body.cost),
        lowStockThreshold: Number(body.lowStockThreshold ?? 5),
        attributes,
        optionNames: options.map((o) => o.name),
        variants: [],
        imageUrl: null,
        isArchived: false,
        movements: [],
        createdAt: "2026-11-17T09:00:00Z",
      };
      const variants = (body.variants as { values: string[]; openingQuantity: number }[]) ?? [];
      if (options.length === 0) addVariant(product, [], variants[0]?.openingQuantity ?? 0, { expiryDate: (body.expiryDate as string) ?? null });
      else variants.forEach((v) => addVariant(product, v.values, v.openingQuantity, { expiryDate: (body.expiryDate as string) ?? null }));
      catalog.products.unshift(product);
      return json(details(catalog, product), 201);
    })),
    http.get(`${base}/products/:id`, withBusiness(({ catalog }, _b, _r, params) => {
      const p = find(catalog, params.id!);
      return p ? json(details(catalog, p)) : notFound();
    })),
    http.put(`${base}/products/:id`, withBusiness(({ catalog }, body, _r, params) => {
      const p = find(catalog, params.id!);
      if (!p) return notFound();
      Object.assign(p, {
        name: String(body.name),
        categoryId: (body.categoryId as string | null) ?? null,
        templateCode: String(body.templateCode),
        sellingPrice: String(body.sellingPrice),
        cost: String(body.cost),
        lowStockThreshold: Number(body.lowStockThreshold),
        attributes: body.attributes ?? {},
        optionNames: (body.optionNames as string[]) ?? p.optionNames,
      });
      return json(details(catalog, p));
    })),
    http.post(`${base}/products/:id/:action`, withBusiness(({ catalog }, body, _r, params) => {
      const p = find(catalog, params.id!);
      if (!p) return notFound();
      if (params.action === "archive" || params.action === "restore") {
        p.isArchived = params.action === "archive";
        return json(details(catalog, p));
      }

      if (params.action === "variants") {
        const values = body.values as string[];
        if (p.variants.some((v) => v.values.join("|").toLowerCase() === values.join("|").toLowerCase())) return problem(409, "product.duplicate_variant", "هاي النسخة موجودة من قبل.");
        if (p.optionNames.length === 0) {
          p.optionNames = body.optionNames as string[];
          p.variants.forEach((v) => (v.isArchived = true));
        }

        addVariant(p, values, Number(body.openingQuantity ?? 0));
        return json(details(catalog, p), 201);
      }

      return notFound();
    })),
    http.put(`${base}/products/:id/variants/:variantId`, withBusiness(({ catalog }, body, _r, params) => {
      const p = find(catalog, params.id!);
      const v = p?.variants.find((x) => x.id === params.variantId);
      if (!p || !v) return problem(404, "product.variant_not_found", "ما لقينا النسخة.");
      Object.assign(v, { priceOverride: body.priceOverride ?? null, costOverride: body.costOverride ?? null, expiryDate: body.expiryDate ?? null });
      return json(details(catalog, p));
    })),
    http.post(`${base}/products/:id/variants/:variantId/:action`, withBusiness(({ catalog }, _b, _r, params) => {
      const p = find(catalog, params.id!);
      const v = p?.variants.find((x) => x.id === params.variantId);
      if (!p || !v) return problem(404, "product.variant_not_found", "ما لقينا النسخة.");
      if (params.action === "archive" && p.variants.filter((x) => !x.isArchived).length === 1) return problem(409, "product.last_variant", "ما بتقدر تأرشف آخر نسخة بالمنتج.");
      v.isArchived = params.action === "archive";
      return json(details(catalog, p));
    })),
    http.put(`${base}/products/:id/image`, withBusiness(({ catalog }, _b, _r, params) => {
      const p = find(catalog, params.id!);
      if (!p) return notFound();
      p.imageUrl = `/api/v1/products/${p.id}/image?v=${seq++}`;
      return json(details(catalog, p));
    })),
  ];
}

/** Seeds a product directly into a fake business catalog (tests only). */
export function seedProduct(
  catalog: FakeCatalog,
  init: { name: string; price?: string; cost?: string; categoryId?: string | null; template?: string; options?: { name: string; values: string[] }[]; stock?: Record<string, number>; simpleStock?: number },
): FakeProduct {
  const product: FakeProduct = {
    id: nextId("p"),
    name: init.name,
    categoryId: init.categoryId ?? null,
    templateCode: init.template ?? "clothing",
    sellingPrice: init.price ?? "38",
    cost: init.cost ?? "17",
    lowStockThreshold: 5,
    attributes: {},
    optionNames: (init.options ?? []).map((o) => o.name),
    variants: [],
    imageUrl: null,
    isArchived: false,
    movements: [],
    createdAt: "2026-11-17T09:00:00Z",
  };
  const options = init.options ?? [];
  if (options.length === 0) {
    addVariant(product, [], init.simpleStock ?? 0);
  } else {
    const combos = options.reduce<string[][]>((rows, o) => rows.flatMap((r) => o.values.map((v) => [...r, v])), [[]]);
    combos.forEach((c) => addVariant(product, c, init.stock?.[c.join(" · ")] ?? 0));
  }

  catalog.products.unshift(product);
  return product;
}
