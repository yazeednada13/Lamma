import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fake } from "@/test/fakeApi";
import { renderApp } from "@/test/renderApp";

describe("dashboard", () => {
  it("the new-user dashboard shows the real business setup", async () => {
    fake.signInOnboarded();
    renderApp("/");
    expect(await screen.findByText("ملابس وأزياء · إنستغرام وواتساب")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "أضف منتج" })).toHaveAttribute("href", "/products/new");
  });
});
