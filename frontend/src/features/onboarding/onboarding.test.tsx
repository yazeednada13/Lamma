import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fake } from "@/test/fakeApi";
import { renderApp } from "@/test/renderApp";

describe("onboarding", () => {
  it("runs name → one type → channels and creates the business", async () => {
    fake.addUser("reem@example.com");
    fake.session = "reem@example.com";
    const { user, router } = renderApp("/onboarding");

    await user.click(await screen.findByRole("button", { name: /متابعة/ }));
    expect(await screen.findByText("اسم المشروع مطلوب.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/اسم المشروع/), "عطور لمى");
    await user.click(screen.getByRole("button", { name: /متابعة/ }));

    const types = await screen.findByRole("radiogroup", { name: "نوع المشروع" });
    expect(within(types).getAllByRole("radio")).toHaveLength(13);
    expect(screen.getByRole("button", { name: /متابعة/ })).toBeDisabled();
    await user.click(within(types).getByRole("radio", { name: /عطور/ }));
    await user.click(within(types).getByRole("radio", { name: /هدايا وبوكسات/ }));
    expect(within(types).getAllByRole("radio", { checked: true })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: /متابعة/ }));

    // Default channels: Instagram + WhatsApp. Turn on Facebook too.
    await user.click(await screen.findByRole("switch", { name: "فيسبوك" }));
    await user.click(screen.getByRole("button", { name: /جهّز مشروعي/ }));

    expect(await screen.findByRole("heading", { name: "كل شي صار بمكانه" })).toBeInTheDocument();
    expect(screen.getByText(/بلّشت تجربتك المجانية — 30 يوم/)).toBeInTheDocument();
    const created = fake.businesses.get("reem@example.com")!;
    expect(created.name).toBe("عطور لمى");
    expect(created.businessType).toBe("gifts");
    expect(created.channels).toEqual({ instagram: true, whatsapp: true, facebook: true, other: false });

    await user.click(screen.getByRole("button", { name: /ادخل على لمّة/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(await screen.findByRole("heading", { name: /أهلًا فيك بلمّة يا ريم/ })).toBeInTheDocument();
  });


  it("cannot finish with no channel selected", async () => {
    fake.addUser("reem@example.com");
    fake.session = "reem@example.com";
    const { user } = renderApp("/onboarding");
    await user.type(await screen.findByLabelText(/اسم المشروع/), "x");
    await user.click(screen.getByRole("button", { name: /متابعة/ }));
    await user.click(await screen.findByRole("radio", { name: /أخرى/ }));
    await user.click(screen.getByRole("button", { name: /متابعة/ }));
    await user.click(await screen.findByRole("switch", { name: "إنستغرام" }));
    await user.click(screen.getByRole("switch", { name: "واتساب" }));
    expect(screen.getByRole("button", { name: /جهّز مشروعي/ })).toBeDisabled();
  });
});
