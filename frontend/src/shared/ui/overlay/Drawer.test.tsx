import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Drawer } from "./Drawer";

function DrawerHarness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        افتح
      </button>
      <Drawer
        open={open}
        onClose={() => {
          setOpen(false);
          onClose?.();
        }}
        title="تغيير كلمة السر"
        footer={<button type="button">حفظ</button>}
      >
        <input aria-label="الحقل الأول" />
      </Drawer>
    </>
  );
}

describe("Drawer", () => {
  it("drawer traps focus, closes with Esc and returns focus to the opener", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);
    const opener = screen.getByRole("button", { name: "افتح" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "تغيير كلمة السر" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));

    // Tab cycles inside the drawer.
    for (let i = 0; i < 4; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });


  it("drawer close button closes it", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DrawerHarness onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "افتح" }));
    await user.click(screen.getByRole("button", { name: "إغلاق" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
