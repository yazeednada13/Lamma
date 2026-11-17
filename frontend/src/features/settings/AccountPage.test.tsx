import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fake } from "@/test/fakeApi";
import { renderApp } from "@/test/renderApp";

describe("account", () => {
  it("account: update the name, and a wrong current password is shown on its field", async () => {
    fake.signInOnboarded();
    const { user } = renderApp("/account");
    expect(screen.queryByText(/LTR/)).not.toBeInTheDocument(); // D-006

    const name = await screen.findByLabelText(/^الاسم/);
    await user.clear(name);
    await user.type(name, "ريم الخطيب الثانية");
    await user.click(screen.getByRole("button", { name: "حفظ" }));
    expect(await screen.findByText("انحفظ الملف الشخصي")).toBeInTheDocument();
    expect(fake.users.get("reem@example.com")?.fullName).toBe("ريم الخطيب الثانية");

    await user.click(screen.getByRole("button", { name: "تغيير" }));
    const drawer = await screen.findByRole("dialog", { name: "تغيير كلمة السر" });
    await user.type(within(drawer).getByLabelText(/كلمة السر الحالية/, { selector: "input" }), "notright1");
    await user.type(within(drawer).getByLabelText(/كلمة السر الجديدة/, { selector: "input" }), "fresh2026");
    await user.click(within(drawer).getByRole("button", { name: "حفظ كلمة السر" }));
    expect(await within(drawer).findByText("كلمة السر الحالية غلط.")).toBeInTheDocument();
  });
});
