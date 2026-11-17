import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon } from "./Icon";

describe("Icon", () => {
  it("icons are decorative and directional ones flip", () => {
    const { container } = render(
      <>
        <Icon name="search" />
        <Icon name="arrow-left" size={16} />
      </>,
    );
    const [search, arrow] = Array.from(container.querySelectorAll("svg"));
    expect(search).toHaveAttribute("aria-hidden", "true");
    expect(search!.innerHTML).toContain("path");
    expect(arrow).toHaveClass("ic", "ic--16", "ic--dir");
  });
});
