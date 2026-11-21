import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fake } from "@/test/fakeApi";
import { renderApp } from "@/test/renderApp";

describe("business settings", () => {
  it("settings load real values and save only the changed sections", async () => {
    fake.signInOnboarded();
    const { user } = renderApp("/settings");

    const name = await screen.findByLabelText(/اسم المشروع/);
    expect(name).toHaveValue("بوتيك ريم");
    expect(screen.getByRole("switch", { name: "إنستغرام" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "زين كاش" })).not.toBeChecked();
    expect(screen.getByText("تصنيفات المصاريف")).toBeInTheDocument(); // Phase 7 section, composed by the app layer

    await user.clear(name);
    await user.type(name, "بوتيك ريم الجديد");
    await user.click(screen.getByRole("switch", { name: "زين كاش" }));
    await user.click(screen.getByRole("button", { name: "حفظ" }));

    expect(await screen.findByText("انحفظت الإعدادات")).toBeInTheDocument();
    const business = fake.businesses.get("reem@example.com")!;
    expect(business.name).toBe("بوتيك ريم الجديد");
    expect(business.methods.zain_cash).toBe(true);
    const puts = fake.requests.filter((r) => r.method === "PUT").map((r) => r.path);
    expect(puts).toEqual(["/settings/business", "/settings/payment-methods"]);
  });


  it("settings block disabling every channel", async () => {
    fake.signInOnboarded();
    const { user } = renderApp("/settings");
    await user.click(await screen.findByRole("switch", { name: "إنستغرام" }));
    await user.click(screen.getByRole("switch", { name: "واتساب" }));
    await user.click(screen.getByRole("button", { name: "حفظ" }));

    expect(await screen.findByText("لازم تفعّل قناة بيع وحدة على الأقل.")).toBeInTheDocument();
    expect(fake.requests.some((r) => r.method === "PUT")).toBe(false);
  });


  it("server field errors appear on the right settings field", async () => {
    fake.signInOnboarded();
    const { user } = renderApp("/settings");
    const threshold = await screen.findByLabelText(/حد «قرب يخلص» الافتراضي/, { selector: "input" });
    await user.clear(threshold);
    await user.type(threshold, "5000");
    await user.click(screen.getByRole("button", { name: "حفظ" }));
    expect(await screen.findByText("الحد لازم يكون بين 0 و 1000.")).toBeInTheDocument();
  });
});
