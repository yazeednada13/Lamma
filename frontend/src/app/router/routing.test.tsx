import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fake } from "@/test/fakeApi";
import { renderApp } from "@/test/renderApp";
import { COMING_SOON_ROUTES } from "./plannedRoutes";

describe("routing and guards", () => {
  it("sends anonymous visitors to login", async () => {
    const { router } = renderApp("/settings");
    expect(await screen.findByRole("heading", { name: "أهلًا فيك من جديد" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });


  it("sends signed-in owners without a business to onboarding", async () => {
    fake.addUser("new@example.com");
    fake.session = "new@example.com";
    const { router } = renderApp("/");
    expect(await screen.findByText(/شو اسم مشروعك؟/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/onboarding");
  });


  it("redirects onboarded owners away from login to the dashboard", async () => {
    fake.signInOnboarded();
    const { router } = renderApp("/login");
    expect(await screen.findByRole("heading", { name: /أهلًا فيك بلمّة يا ريم/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });


  it("shows the 404 page for unknown paths", async () => {
    fake.signInOnboarded();
    renderApp("/nope");
    expect(await screen.findByText("404")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "هالصفحة مش بمكانها" })).toBeInTheDocument();
  });


  it("every unbuilt module opens the coming-soon page without fake data (D-085)", async () => {
    fake.signInOnboarded();
    for (const route of COMING_SOON_ROUTES) {
      const view = renderApp(`/${route.path}`);
      expect(await screen.findByRole("heading", { name: "هذا القسم قيد التطوير" })).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: route.title })).toBeInTheDocument();
      view.unmount();
    }
  });
});
