import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fake } from "@/test/fakeApi";
import { renderApp } from "@/test/renderApp";

describe("landing page and public sign-up (D-160, D-174)", () => {
  it("an anonymous visitor at / sees the landing page; the form sends name, email, mobile and the UTM source", async () => {
    const { user } = renderApp("/?utm_source=ig&utm_medium=social");
    expect(await screen.findByRole("heading", { name: /كل شغلك/ })).toBeInTheDocument();
    // Pricing (D-165): yearly by default; the switch flips to the monthly price.
    expect(screen.getByRole("button", { name: /سنوي/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("90")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "شهري" }));
    expect(screen.getByText("9")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ابعتلي رابط التسجيل/ }));
    expect(await screen.findByText("الاسم مطلوب.")).toBeInTheDocument();
    expect(screen.getByText("رقم الموبايل مطلوب.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/اسمك/), "ريم الخطيب");
    await user.type(screen.getByLabelText(/الإيميل/), "reem@gmail.com");
    await user.type(screen.getByLabelText(/رقم الموبايل/), "0612345678");
    await user.click(screen.getByRole("button", { name: /ابعتلي رابط التسجيل/ }));
    expect(await screen.findByText("اكتب رقم موبايل أردني، مثلًا 0791234567.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/رقم الموبايل/));
    await user.type(screen.getByLabelText(/رقم الموبايل/), "0791234567");
    await user.click(screen.getByRole("button", { name: /ابعتلي رابط التسجيل/ }));
    expect(await screen.findByText(/تفقّد إيميلك/)).toBeInTheDocument();
    expect(screen.getByText("r***@gmail.com")).toBeInTheDocument();
    await waitFor(() => expect(fake.signups).toHaveLength(1));
    expect(fake.signups[0]).toMatchObject({ fullName: "ريم الخطيب", email: "reem@gmail.com", phone: "0791234567", storeName: null, website: "", utmSource: "ig", utmMedium: "social" });
  });

  it("a signed-in owner at / still gets the dashboard", async () => {
    fake.addUser("reem@example.com");
    fake.addBusiness("reem@example.com");
    fake.session = "reem@example.com";
    renderApp("/");
    expect(await screen.findByRole("heading", { name: /أهلًا فيك بلمّة يا ريم/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ابعتلي رابط التسجيل/ })).not.toBeInTheDocument();
  });
});
