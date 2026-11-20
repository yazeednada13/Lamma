import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ApiError } from "@/services/api/apiClient";
import { ConfirmProvider, useConfirm, type ConfirmOptions } from "./ConfirmProvider";

function Harness({ options, onResult }: { options: ConfirmOptions; onResult: (value: boolean) => void }) {
  const confirm = useConfirm();
  return (
    <button type="button" onClick={async () => onResult(await confirm(options))}>
      افتح
    </button>
  );
}

function setup(options: ConfirmOptions) {
  const results: boolean[] = [];
  render(
    <ConfirmProvider>
      <Harness options={options} onResult={(v) => results.push(v)} />
    </ConfirmProvider>,
  );
  return { results, user: userEvent.setup() };
}

describe("shared confirmation dialog", () => {
  it("resolves true on confirm and false on cancel or Esc", async () => {
    const { results, user } = setup({ title: "أرشفة العميل؟", subject: "رنا", confirmLabel: "أرشفة", tone: "warning", icon: "archive" });

    await user.click(screen.getByRole("button", { name: "افتح" }));
    expect(screen.getByRole("alertdialog", { name: "أرشفة العميل؟" })).toBeInTheDocument();
    expect(screen.getByText("رنا")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "أرشفة" }));

    await user.click(screen.getByRole("button", { name: "افتح" }));
    await user.click(screen.getByRole("button", { name: "إلغاء" }));

    await user.click(screen.getByRole("button", { name: "افتح" }));
    await user.keyboard("{Escape}");

    expect(results).toEqual([true, false, false]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps the dialog open with the server message when the action fails", async () => {
    let calls = 0;
    const { results, user } = setup({
      title: "حذف التصنيف؟",
      confirmLabel: "حذف",
      tone: "danger",
      action: async () => {
        calls++;
        if (calls === 1) throw new ApiError(409, "category.has_products", "التصنيف فيه 1 منتج.");
      },
    });

    await user.click(screen.getByRole("button", { name: "افتح" }));
    await user.click(screen.getByRole("button", { name: "حذف" }));
    expect(await screen.findByText("التصنيف فيه 1 منتج.")).toBeInTheDocument();
    expect(results).toEqual([]);

    await user.click(screen.getByRole("button", { name: "حذف" }));
    expect(results).toEqual([true]);
  });
});
