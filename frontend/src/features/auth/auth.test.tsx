import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fake } from "@/test/fakeApi";
import { renderApp } from "@/test/renderApp";

describe("authentication pages", () => {
  it("sign-up validates on the client, then creates the account and opens onboarding", async () => {
    const { user, router } = renderApp("/signup");
    await user.click(await screen.findByRole("button", { name: /إنشاء الحساب/ }));
    expect(await screen.findByText("الاسم مطلوب.")).toBeInTheDocument();
    expect(screen.getByText("الإيميل مطلوب.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/اسمك/), "ريم");
    await user.type(screen.getByLabelText(/الإيميل/), "reem@example.com");
    await user.type(screen.getByLabelText(/كلمة السر/, { selector: "input" }), "lamma2026");
    await user.click(screen.getByRole("button", { name: /إنشاء الحساب/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/onboarding"));
    expect(fake.users.get("reem@example.com")?.fullName).toBe("ريم");
  });


  it("sign-up shows password strength while typing", async () => {
    const { user } = renderApp("/signup");
    const meter = await screen.findByRole("meter", { name: "قوة كلمة السر" });
    expect(meter).toHaveAttribute("aria-valuenow", "0");
    await user.type(screen.getByLabelText(/كلمة السر/, { selector: "input" }), "Phase1test2026");
    expect(meter).toHaveAttribute("aria-valuenow", "4");
  });


  it("a taken email is shown on the email field", async () => {
    fake.addUser("taken@example.com");
    const { user } = renderApp("/signup");
    await user.type(await screen.findByLabelText(/اسمك/), "ريم");
    await user.type(screen.getByLabelText(/الإيميل/), "taken@example.com");
    await user.type(screen.getByLabelText(/كلمة السر/, { selector: "input" }), "lamma2026");
    await user.click(screen.getByRole("button", { name: /إنشاء الحساب/ }));

    expect(await screen.findByText("هاد الإيميل مسجّل من قبل. جرّب تسجّل دخول.")).toBeInTheDocument();
    expect(screen.getByLabelText(/الإيميل/)).toHaveAttribute("aria-invalid", "true");
  });


  it("wrong credentials and lockout show the server's Arabic message", async () => {
    const owner = fake.addUser("reem@example.com");
    const { user } = renderApp("/login");
    await user.type(await screen.findByLabelText(/الإيميل/), "reem@example.com");
    await user.type(screen.getByLabelText(/كلمة السر/, { selector: "input" }), "wrongpass1");
    await user.click(screen.getByRole("button", { name: /دخول/ }));
    expect(await screen.findByText("الإيميل أو كلمة السر غلط.")).toBeInTheDocument();

    owner.failures = 5;
    await user.click(screen.getByRole("button", { name: /دخول/ }));
    expect(await screen.findByText(/انقفل حسابك مؤقتًا/)).toBeInTheDocument();
  });


  it("login lands on the dashboard for an onboarded owner", async () => {
    fake.addUser("reem@example.com");
    fake.addBusiness("reem@example.com");
    const { user, router } = renderApp("/login");
    await user.type(await screen.findByLabelText(/الإيميل/), "reem@example.com");
    await user.type(screen.getByLabelText(/كلمة السر/, { selector: "input" }), "lamma2026");
    await user.click(screen.getByRole("button", { name: /دخول/ }));

    expect(await screen.findByRole("heading", { name: /أهلًا فيك بلمّة يا ريم/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });


  it("forgot password confirms without revealing whether the email exists", async () => {
    const { user } = renderApp("/forgot-password");
    await user.type(await screen.findByLabelText(/الإيميل/), "anyone@example.com");
    await user.click(screen.getByRole("button", { name: "أرسل الرابط" }));
    expect(await screen.findByText(/إذا الإيميل anyone@example.com مسجّل عنا/)).toBeInTheDocument();
    expect(fake.resetRequests).toEqual(["anyone@example.com"]);
  });


  it("reset password handles a broken link, an invalid token and success", async () => {
    const broken = renderApp("/reset-password");
    expect(await screen.findByText(/رابط الاستعادة ناقص أو غلط/)).toBeInTheDocument();
    broken.unmount();

    fake.addUser("reem@example.com");
    const bad = renderApp("/reset-password?email=reem%40example.com&token=nope");
    await bad.user.type(await screen.findByLabelText(/كلمة السر الجديدة/, { selector: "input" }), "fresh2026");
    await bad.user.click(screen.getByRole("button", { name: "حفظ كلمة السر" }));
    expect(await screen.findByText(/رابط الاستعادة غير صالح أو انتهت صلاحيته/)).toBeInTheDocument();
    bad.unmount();

    const good = renderApp("/reset-password?email=reem%40example.com&token=valid-token");
    await good.user.type(await screen.findByLabelText(/كلمة السر الجديدة/, { selector: "input" }), "fresh2026");
    await good.user.click(screen.getByRole("button", { name: "حفظ كلمة السر" }));
    expect(await screen.findByText(/تغيّرت كلمة السر/)).toBeInTheDocument();
    expect(fake.users.get("reem@example.com")?.password).toBe("fresh2026");
  });
});
