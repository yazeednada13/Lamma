import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, IconButton } from "./Button";

describe("Button", () => {
  it("a loading button is disabled and busy", () => {
    render(<Button loading>حفظ</Button>);
    const button = screen.getByRole("button", { name: "حفظ" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveClass("btn", "btn--primary", "is-loading");
  });


  it("icon buttons always have an accessible name", () => {
    render(<IconButton icon="x" label="إغلاق" />);
    expect(screen.getByRole("button", { name: "إغلاق" })).toBeInTheDocument();
  });
});
