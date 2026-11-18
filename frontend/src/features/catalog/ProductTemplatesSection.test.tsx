import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fake } from "@/test/fakeApi";
import { renderApp } from "@/test/renderApp";

describe("settings → templates and custom fields", () => {
  it("lists system fields and adds a custom select field to a template", async () => {
    fake.signInOnboarded();
    const { user } = renderApp("/settings");

    const section = await screen.findByRole("region", { name: "القوالب والحقول الخاصة" });
    expect(await within(section).findByText("الخامة")).toBeInTheDocument();
    expect(within(section).getAllByText("من لمّة").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /القوالب والحقول/ })).toBeInTheDocument(); // section nav entry

    await user.click(within(section).getByRole("radio", { name: /بوكس هدايا/ }));
    await user.click(within(section).getByRole("button", { name: "حقل خاص" }));
    const drawer = await screen.findByRole("dialog", { name: "حقل جديد لقالب بوكس هدايا" });
    await user.type(within(drawer).getByLabelText(/اسم الحقل/), "الغلاف");
    await user.selectOptions(within(drawer).getByLabelText("نوع الحقل"), "select");
    await user.type(within(drawer).getByLabelText(/الخيارات/), "ورق{Enter}قماش");
    await user.click(within(drawer).getByRole("button", { name: "حفظ" }));

    expect(await screen.findByText("انضاف حقل «الغلاف»")).toBeInTheDocument();
    expect(await within(section).findByText("الغلاف")).toBeInTheDocument();
    const field = fake.businesses.get("reem@example.com")!.catalog.customFields.gift![0]!;
    expect(field).toMatchObject({ labelAr: "الغلاف", type: "select", options: ["ورق", "قماش"] });
  });

  it("uses the API business-type labels in the profile section (D-103)", async () => {
    fake.signInOnboarded();
    renderApp("/settings");

    const type = await screen.findByLabelText("نوع المشروع");
    expect(within(type).getAllByRole("option")).toHaveLength(13);
    expect(type).toHaveDisplayValue("ملابس وأزياء");
  });
});
