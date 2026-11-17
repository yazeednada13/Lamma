import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fake } from "@/test/fakeApi";
import { renderApp } from "@/test/renderApp";

describe("app shell", () => {
  it("shows the real business, trial days and owner from the API", async () => {
    fake.signInOnboarded();
    fake.trialDaysRemaining = 18;
    renderApp("/");

    const sidebar = await screen.findByRole("complementary", { name: "القائمة الرئيسية" });
    expect(within(sidebar).getByText("بوتيك ريم")).toBeInTheDocument();
    expect(within(sidebar).getByText("تجربة مجانية · ضل 18 يوم")).toBeInTheDocument();
    expect(within(sidebar).getByText("12 من 30 يوم تجربة")).toBeInTheDocument();
    expect(within(sidebar).getByText("ريم الخطيب")).toBeInTheDocument();
  });


  it("every sidebar link resolves to a page (never the 404)", async () => {
    fake.signInOnboarded();
    const { user, router } = renderApp("/");
    const sidebar = await screen.findByRole("navigation", { name: "أقسام لمّة" });
    const hrefs = within(sidebar)
      .getAllByRole("link")
      .map((a) => a.getAttribute("href")!);

    for (const href of new Set(hrefs)) {
      await router.navigate(href);
      await waitFor(() => expect(router.state.location.pathname).toBe(href));
      expect(screen.queryByText("404")).not.toBeInTheDocument();
    }

    expect(user).toBeDefined();
  });


  it("marks the active section and opens its submenu", async () => {
    fake.signInOnboarded();
    renderApp("/inventory/receive");
    const link = await screen.findByRole("link", { name: "المخزون" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveClass("is-active", "is-open");
    expect(screen.getByRole("link", { name: "استلام بضاعة" })).toHaveClass("is-active");
  });


  it("shows the late-trial banner in the last 3 days", async () => {
    fake.signInOnboarded();
    fake.trialDaysRemaining = 2;
    renderApp("/");
    expect(await screen.findByText(/ضل 2 يوم بس من التجربة/)).toBeInTheDocument();
  });


  it("search and notifications are visibly marked as coming soon", async () => {
    fake.signInOnboarded();
    renderApp("/");
    expect(await screen.findByRole("button", { name: "الإشعارات (قريبًا)" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByRole("button", { name: "البحث (قريبًا)" })[0]).toHaveAttribute("aria-disabled", "true");
  });


  it("logout ends the session and returns to login", async () => {
    fake.signInOnboarded();
    const { user, router } = renderApp("/");
    await user.click(await screen.findByRole("button", { name: "الحساب" }));
    await user.click(screen.getByRole("menuitem", { name: /تسجيل الخروج/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(fake.session).toBeNull();
  });


  it("collapsing the sidebar is remembered", async () => {
    window.innerWidth = 1440; // desktop width: the sidebar is expanded by default
    fake.signInOnboarded();
    const { user, container } = renderApp("/");
    await user.click(await screen.findByRole("button", { name: "تصغير القائمة" }));
    expect(container.querySelector(".app")).toHaveClass("is-collapsed");
    expect(window.localStorage.getItem("lamma-collapsed")).toBe("1");
  });
});
