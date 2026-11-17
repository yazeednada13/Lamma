import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PasswordField } from "./PasswordField";
import { PasswordStrength, passwordScore } from "./PasswordStrength";
import { TextField } from "./TextField";

describe("form fields", () => {
  it("text field errors are announced and marked invalid", () => {
    render(<TextField label="الإيميل" error="اكتب إيميل صحيح" />);
    const input = screen.getByLabelText(/الإيميل/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("اكتب إيميل صحيح");
    expect(screen.getByRole("alert")).toHaveTextContent("اكتب إيميل صحيح");
  });


  it("password field can show and hide the password", async () => {
    const user = userEvent.setup();
    render(<PasswordField label="كلمة السر" />);
    const input = screen.getByLabelText(/كلمة السر/, { selector: "input" });
    expect(input).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "إظهار كلمة السر" }));
    expect(input).toHaveAttribute("type", "text");
  });


  it("password strength uses the prototype's four rules", () => {
    expect(passwordScore("")).toBe(0);
    expect(passwordScore("abcdefgh")).toBe(2);
    expect(passwordScore("lamma2026")).toBe(3);
    expect(passwordScore("لمّة-2026-قوية")).toBe(4);
    render(<PasswordStrength password="lamma2026" />);
    expect(screen.getByRole("meter", { name: "قوة كلمة السر" })).toHaveAttribute("aria-valuenow", "3");
  });
});
