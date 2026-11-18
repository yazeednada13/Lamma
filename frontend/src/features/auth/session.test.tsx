import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fake } from "@/test/fakeApi";
import { renderApp } from "@/test/renderApp";

describe("session", () => {
  it("an expired session anywhere returns to login", async () => {
    fake.signInOnboarded();
    const { user, router, client } = renderApp("/settings");
    const name = await screen.findByLabelText(/اسم المشروع/);
    // Let the page's other requests (e.g. the templates section) finish first; any of them would also see the
    // expired session and redirect, which is correct but would race with the steps below.
    await waitFor(() => expect(client.isFetching()).toBe(0));

    fake.session = null; // the server-side session ends (e.g. password changed on another device)
    await user.clear(name);
    await user.type(name, "x");
    await user.click(screen.getByRole("button", { name: "حفظ" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    expect(await screen.findByRole("heading", { name: "أهلًا فيك من جديد" })).toBeInTheDocument();
  });
});
