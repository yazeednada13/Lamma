import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fake } from "@/test/fakeApi";
import { seedProduct } from "@/test/fakeCatalog";
import { renderApp } from "@/test/renderApp";

const catalog = () => fake.businesses.get("reem@example.com")!.catalog;

describe("categories", () => {
  it("adds and renames a category", async () => {
    fake.signInOnboarded();
    const { user } = renderApp("/products/categories");

    await user.click(await screen.findByRole("button", { name: "أضف تصنيف" }));
    const drawer = await screen.findByRole("dialog", { name: "تصنيف جديد" });
    await user.type(within(drawer).getByLabelText(/اسم التصنيف/), "فساتين");
    await user.click(within(drawer).getByRole("button", { name: "حفظ" }));

    expect(await screen.findByText("انضاف تصنيف «فساتين»")).toBeInTheDocument();
    expect(await screen.findByText("0 منتجات بالنظام")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "تعديل فساتين" }));
    const rename = await screen.findByRole("dialog", { name: "تعديل التصنيف" });
    const input = within(rename).getByLabelText(/اسم التصنيف/);
    await user.clear(input);
    await user.type(input, "فساتين صيفية");
    await user.click(within(rename).getByRole("button", { name: "حفظ" }));
    expect(await screen.findByText("فساتين صيفية")).toBeInTheDocument();
  });

  it("shows the duplicate-name error on the field", async () => {
    fake.signInOnboarded();
    catalog().categories.push({ id: "c-1", name: "عطور", isArchived: false });
    const { user } = renderApp("/products/categories");

    await user.click(await screen.findByRole("button", { name: "تصنيف" }));
    const drawer = await screen.findByRole("dialog", { name: "تصنيف جديد" });
    await user.type(within(drawer).getByLabelText(/اسم التصنيف/), "عطور");
    await user.click(within(drawer).getByRole("button", { name: "حفظ" }));

    expect(await within(drawer).findByText("في تصنيف بنفس الاسم.")).toBeInTheDocument();
  });

  it("explains why a category with active products cannot be deleted", async () => {
    fake.signInOnboarded();
    catalog().categories.push({ id: "c-1", name: "عطور", isArchived: false });
    seedProduct(catalog(), { name: "عطر", categoryId: "c-1" });
    const { user } = renderApp("/products/categories");

    await user.click(await screen.findByRole("button", { name: "حذف عطور" }));
    const dialog = await screen.findByRole("alertdialog", { name: "حذف التصنيف؟" });
    expect(within(dialog).getByText("عطور")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "حذف" }));

    expect(await within(dialog).findByText(/التصنيف فيه 1 منتج/)).toBeInTheDocument();
    expect(catalog().categories).toHaveLength(1);
  });
});
