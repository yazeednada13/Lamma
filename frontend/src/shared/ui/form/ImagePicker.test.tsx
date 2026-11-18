import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ImagePicker, imageFileProblem } from "./ImagePicker";

describe("ImagePicker", () => {
  it("pre-checks the type and the 5 MB limit (the server checks the real content)", () => {
    expect(imageFileProblem(new File(["x"], "a.png", { type: "image/png" }))).toBeNull();
    expect(imageFileProblem(new File(["x"], "a.gif", { type: "image/gif" }))).toBe("الصورة لازم تكون JPG أو PNG أو WEBP.");
    expect(imageFileProblem(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" }))).toBe("حجم الصورة لازم يكون 5 ميجا أو أقل.");
  });

  it("passes a valid file to its owner and shows the problem for an invalid one", async () => {
    const onChange = vi.fn();
    render(<ImagePicker value={null} onChange={onChange} label="صورة المنتج" />);
    const input = screen.getByLabelText("صورة المنتج");

    await userEvent.upload(input, new File(["x"], "ok.webp", { type: "image/webp" }));
    expect(onChange).toHaveBeenCalledTimes(1);

    await userEvent.upload(input, new File(["x"], "bad.gif", { type: "image/gif" }), { applyAccept: false });
    expect(await screen.findByRole("alert")).toHaveTextContent("JPG أو PNG أو WEBP");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
