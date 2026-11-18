import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fake } from "@/test/fakeApi";
import { seedProduct } from "@/test/fakeCatalog";
import { renderApp } from "@/test/renderApp";

const catalog = () => fake.businesses.get("reem@example.com")!.catalog;

describe("product details", () => {
  it("shows the hero, the size × colour stock map and the opening movements", async () => {
    fake.signInOnboarded();
    const p = seedProduct(catalog(), {
      name: "فستان كتان",
      options: [
        { name: "المقاس", values: ["S", "M"] },
        { name: "اللون", values: ["زيتي", "كريمي"] },
      ],
      stock: { "S · زيتي": 3, "M · كريمي": 1 },
    });
    renderApp(`/products/${p.id}`);

    expect(await screen.findByRole("heading", { name: "فستان كتان" })).toBeInTheDocument();
    expect(screen.getByText("خريطة المقاس واللون")).toBeInTheDocument();
    expect(screen.getByTitle("S · زيتي: موجود 3، محجوز 0")).toHaveTextContent("3");
    expect(screen.getByTitle("M · زيتي: موجود 0، محجوز 0")).toHaveTextContent("نفد");
    expect(screen.getAllByText("كمية افتتاحية")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /تعديل المخزون/ })).toBeDisabled(); // Phase 3
    expect(screen.getByRole("link", { name: "تعديل" })).toHaveAttribute("href", `/products/${p.id}/edit`);
  });

  it("archives a variant and edits a variant's own price", async () => {
    fake.signInOnboarded();
    const p = seedProduct(catalog(), { name: "عطر عود", template: "perfume", options: [{ name: "الحجم", values: ["10 مل", "50 مل"] }] });
    const { user } = renderApp(`/products/${p.id}`);

    await user.click(await screen.findByRole("button", { name: "أرشف 10 مل" }));
    expect(await screen.findByText("انأرشفت النسخة 10 مل")).toBeInTheDocument();
    expect(screen.getByText("مؤرشفة")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "أرشف 50 مل" })).not.toBeInTheDocument(); // the last active variant stays

    await user.click(screen.getByRole("button", { name: "تعديل 50 مل" }));
    const drawer = await screen.findByRole("dialog", { name: "النسخة 50 مل" });
    await user.type(within(drawer).getByLabelText(/سعر خاص/), "24");
    await user.click(within(drawer).getByRole("button", { name: "حفظ" }));

    expect(await screen.findByText("انحفظت النسخة")).toBeInTheDocument();
    expect(catalog().products[0]!.variants[1]!.priceOverride).toBe("24.000");
  });

  it("archives and restores the product", async () => {
    fake.signInOnboarded();
    const p = seedProduct(catalog(), { name: "كريم", template: "beauty" });
    const { user } = renderApp(`/products/${p.id}`);

    await user.click(await screen.findByRole("button", { name: "أرشف" }));
    expect(await screen.findByText("مؤرشف")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "استرجع المنتج" }));
    expect(await screen.findByText(/رجع «كريم» للمنتجات/)).toBeInTheDocument();
  });

  it("shows not-found for another business's product", async () => {
    fake.signInOnboarded();
    renderApp("/products/p-unknown");

    expect(await screen.findByText("ما لقينا المنتج.")).toBeInTheDocument();
  });
});
