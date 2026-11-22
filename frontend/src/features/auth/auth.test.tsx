import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fake } from "@/test/fakeApi";
import { renderApp } from "@/test/renderApp";

describe("authentication pages", () => {
  it("registers from the emailed link with a locked email, then opens onboarding", async () => {
    fake.invitations.set("tok-1", { email: "reem@example.com", fullName: "ريم الخطيب", state: "valid" });
    const { user, router } = renderApp("/register?token=tok-1");
    expect(await screen.findByText(/أهلًا ريم/)).toBeInTheDocument();
    expect(screen.getByLabelText(/الإيميل/)).toHaveValue("reem@example.com");
    expect(screen.getByLabelText(/الإيميل/)).toBeDisabled();

    const meter = screen.getByRole("meter", { name: "قوة كلمة السر" });
    await user.type(screen.getByLabelText(/^كلمة السر/, { selector: "input" }), "Phase1test2026");
    expect(meter).toHaveAttribute("aria-valuenow", "4");
    await user.type(screen.getByLabelText(/تأكيد كلمة السر/, { selector: "input" }), "Phase1test2025");
    await user.click(screen.getByRole("button", { name: /ابدأ تجربتي المجانية/ }));
    expect(await screen.findByText("تأكيد كلمة السر مش مطابق.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/تأكيد كلمة السر/, { selector: "input" }));
    await user.type(screen.getByLabelText(/تأكيد كلمة السر/, { selector: "input" }), "Phase1test2026");
    await user.click(screen.getByRole("button", { name: /ابدأ تجربتي المجانية/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/onboarding"));
    expect(fake.users.get("reem@example.com")?.fullName).toBe("ريم الخطيب");
  });


  it("an expired link explains itself and offers a new one", async () => {
    fake.invitations.set("old", { email: "a@b.co", fullName: "ريم", state: "expired" });
    renderApp("/register?token=old");
    expect(await screen.findByText("رابط التسجيل انتهت صلاحيته.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ابعتلي رابط جديد/ })).toHaveAttribute("href", "/#join");
  });


  it("the old sign-up address leads to the landing form", async () => {
    const { router } = renderApp("/signup");
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(router.state.location.hash).toBe("#join");
    expect(await screen.findByRole("heading", { name: /كل شغلك/ })).toBeInTheDocument();
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
