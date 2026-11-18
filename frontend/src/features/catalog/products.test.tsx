import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fake } from "@/test/fakeApi";
import { seedProduct } from "@/test/fakeCatalog";
import { renderApp } from "@/test/renderApp";

const catalog = () => fake.businesses.get("reem@example.com")!.catalog;
// Saving navigates to the details page and loads it; under parallel full-app renders that chain can exceed
// the default 3s wait (FRONTEND-ARCHITECTURE §11 E-9).
const AFTER_SAVE = { timeout: 10_000 };
const posted = (path: string) => fake.requests.filter((r) => r.method === "POST" && r.path === path).map((r) => r.body as Record<string, unknown>);

describe("products list", () => {
  it("shows an empty state for a new business with a link to add a product", async () => {
    fake.signInOnboarded();
    renderApp("/products");

    expect(await screen.findByText("لسا ما أضفت منتجات")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "أضف منتج" })).toHaveAttribute("href", "/products/new");
  });

  it("lists real products with stock status and filters by stock and category", async () => {
    fake.signInOnboarded();
    const c = catalog();
    c.categories.push({ id: "cat-1", name: "عطور", isArchived: false });
    seedProduct(c, { name: "فستان كتان", options: [{ name: "المقاس", values: ["S", "M"] }], stock: { S: 3, M: 9 } });
    seedProduct(c, { name: "عطر عود", template: "perfume", categoryId: "cat-1", simpleStock: 2 });
    const { user } = renderApp("/products");

    expect(await screen.findByText("فستان كتان")).toBeInTheDocument();
    expect(screen.getByText("عطر عود")).toBeInTheDocument();
    expect(screen.getByText("2 منتج · 1 تصنيفات")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /قرب يخلص/ }));
    await waitFor(() => expect(screen.queryByText("فستان كتان")).not.toBeInTheDocument());
    expect(screen.getByText("عطر عود")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "عطور" }));
    expect(fake.requests.some((r) => r.path === "/products" && r.method === "GET")).toBe(true);
    await user.click(screen.getByRole("button", { name: "جدول" }));
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });
});

describe("new product", () => {
  it("creates a simple product with an opening quantity, defaulting to the business template", async () => {
    fake.signInOnboarded(); // clothing business → clothing template
    const { user } = renderApp("/products/new");

    expect(await screen.findByRole("radio", { name: /ملابس/ })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("radio", { name: /تجميل/ }));
    await user.type(screen.getByLabelText(/اسم المنتج/), "كريم ترطيب");
    await user.type(screen.getByLabelText(/سعر البيع/), "12");
    await user.type(screen.getByLabelText(/التكلفة/), "5");
    expect(screen.getByText(/ربحك بالقطعة/)).toBeInTheDocument();
    const quantity = screen.getByLabelText(/الكمية الافتتاحية/);
    await user.clear(quantity);
    await user.type(quantity, "6");
    await user.click(screen.getByRole("button", { name: "حفظ المنتج" }));

    expect(await screen.findByRole("heading", { name: "كريم ترطيب" }, AFTER_SAVE)).toBeInTheDocument();
    const [body] = posted("/products");
    expect(body).toMatchObject({ name: "كريم ترطيب", templateCode: "beauty", sellingPrice: "12.000", cost: "5.000", lowStockThreshold: 5, options: [], variants: [{ values: [], openingQuantity: 6 }] });
    expect(await screen.findByText(/انضاف «كريم ترطيب»/)).toBeInTheDocument();
  });

  it("builds a size × colour matrix and sends every combination with its quantity", async () => {
    fake.signInOnboarded();
    const { user } = renderApp("/products/new");

    await user.type(await screen.findByLabelText(/اسم المنتج/), "فستان كتان صيفي");
    await user.type(screen.getByLabelText(/سعر البيع/), "38");
    await user.type(screen.getByLabelText(/التكلفة/), "17");
    await user.click(screen.getByRole("button", { name: "S" }));
    await user.click(screen.getByRole("button", { name: "M" }));
    await user.click(screen.getByRole("button", { name: /زيتي/ }));
    const cell = screen.getByRole("textbox", { name: "S · زيتي" });
    await user.clear(cell);
    await user.type(cell, "3");
    expect(screen.getByText(/2 نسخة/, { selector: ".osec__h .caption" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "حفظ المنتج" }));

    await screen.findByRole("heading", { name: "فستان كتان صيفي" }, AFTER_SAVE);
    const [body] = posted("/products");
    expect(body!.options).toEqual([{ name: "المقاس", values: ["S", "M"] }, { name: "اللون", values: ["زيتي"] }]);
    expect(body!.variants).toEqual([{ values: ["S", "زيتي"], openingQuantity: 3 }, { values: ["M", "زيتي"], openingQuantity: 0 }]);
  });

  it("validates required money fields on the client and shows server field errors", async () => {
    fake.signInOnboarded();
    const { user } = renderApp("/products/new");

    await user.type(await screen.findByLabelText(/اسم المنتج/), "x");
    await user.click(screen.getByRole("button", { name: "حفظ المنتج" }));
    expect(await screen.findByText("سعر البيع مطلوب.")).toBeInTheDocument();
    expect(screen.getByText("التكلفة مطلوبة، اكتب 0 إذا ما في تكلفة.")).toBeInTheDocument();
    expect(posted("/products")).toHaveLength(0);

    await user.type(screen.getByLabelText(/سعر البيع/), "10.555");
    await user.click(screen.getByRole("button", { name: "حفظ المنتج" }));
    expect(await screen.findByText("اكتب مبلغ صحيح، بخانتين عشريتين كحد أقصى.")).toBeInTheDocument();
  });

  it("uploads the chosen image after creating the product", async () => {
    fake.signInOnboarded();
    const { user } = renderApp("/products/new");

    await user.type(await screen.findByLabelText(/اسم المنتج/), "شنطة");
    await user.type(screen.getByLabelText(/سعر البيع/), "20");
    await user.type(screen.getByLabelText(/التكلفة/), "8");
    await user.upload(screen.getByLabelText("صورة المنتج"), new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "bag.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: "حفظ المنتج" }));

    await screen.findByRole("heading", { name: "شنطة" }, AFTER_SAVE);
    expect(fake.requests.some((r) => r.method === "PUT" && /\/products\/p\d+\/image/.test(r.path))).toBe(true);
    expect(catalog().products[0]!.imageUrl).toMatch(/\/image\?v=/);
  });
});

describe("edit product", () => {
  it("shows saved stock read-only, renames details and adds only the new combination", async () => {
    fake.signInOnboarded();
    const p = seedProduct(catalog(), { name: "فستان", options: [{ name: "المقاس", values: ["S"] }], stock: { S: 4 } });
    const { user } = renderApp(`/products/${p.id}/edit`);

    const name = await screen.findByLabelText(/اسم المنتج/);
    expect(name).toHaveValue("فستان");
    expect(screen.queryByRole("textbox", { name: "S" })).not.toBeInTheDocument(); // saved cell is not an input
    await user.clear(name);
    await user.type(name, "فستان صيفي");
    await user.click(screen.getByRole("button", { name: "M" }));
    const cell = screen.getByRole("textbox", { name: "M" });
    await user.clear(cell);
    await user.type(cell, "2");
    await user.click(screen.getByRole("button", { name: "احفظ التعديلات" }));

    expect(await screen.findByRole("heading", { name: "فستان صيفي" }, AFTER_SAVE)).toBeInTheDocument();
    expect(posted(`/products/${p.id}/variants`)).toEqual([{ values: ["M"], openingQuantity: 2, expiryDate: null }]);
    const variantsTable = screen.getAllByRole("table").at(-1)!;
    expect(within(variantsTable).getByText("S")).toBeInTheDocument();
    expect(within(variantsTable).getByText("M")).toBeInTheDocument();
    expect(catalog().products[0]!.variants.map((v) => [v.values.join(), v.onHand])).toEqual([["S", 4], ["M", 2]]);
  });
});
