import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./ToastProvider";

describe("toasts", () => {
  it("toasts show a message and run their action", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    function Trigger() {
      const toast = useToast();
      return (
        <button type="button" onClick={() => toast("انحفظت الإعدادات", { action: "تراجع", onAction: onUndo })}>
          أرسل
        </button>
      );
    }

    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "أرسل" }));
    expect(screen.getByText("انحفظت الإعدادات")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "تراجع" }));
    expect(onUndo).toHaveBeenCalledOnce();
  });
});
