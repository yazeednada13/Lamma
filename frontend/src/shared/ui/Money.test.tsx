import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Money } from "./Money";

describe("Money", () => {
  it("money shows 2 decimals, Latin digits and the currency after the number", () => {
    const { container } = render(<Money value="1234.505" />);
    expect(container.querySelector("bdi")).toHaveTextContent("1,234.51");
    expect(container.textContent).toBe("1,234.51 د.أ");
  });
});
