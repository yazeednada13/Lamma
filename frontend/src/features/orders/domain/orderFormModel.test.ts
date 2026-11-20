import { describe, expect, it } from "vitest";
import type { ProductWithVariants } from "../api/ordersApi";
import { emptyOrderForm, linePrice, lineFrom, orderBody } from "./orderFormModel";

const dress: ProductWithVariants = {
  id: "p1",
  name: "فستان",
  templateCode: "clothing",
  imageUrl: null,
  isArchived: false,
  variants: [
    { id: "v-s", label: "S", price: "38.000", cost: "17.000", available: 0, isArchived: false, isDefault: false },
    { id: "v-m", label: "M", price: "38.000", cost: "17.000", available: 2, isArchived: false, isDefault: false },
    { id: "v-l", label: "L", price: "42.500", cost: "17.000", available: 4, isArchived: false, isDefault: false },
    { id: "v-x", label: "XL", price: "42.500", cost: "17.000", available: 9, isArchived: true, isDefault: false },
  ],
};

describe("order form model", () => {
  it("adds the first active variant with stock that is not already on a line", () => {
    expect(lineFrom(dress, [])?.variantId).toBe("v-m");
    expect(lineFrom(dress, ["v-m"])?.variantId).toBe("v-l");
    expect(lineFrom(dress, ["v-m", "v-l"])).toBeNull(); // S is out, XL is archived
  });

  it("uses the kept snapshot price until the variant changes", () => {
    const line = { ...lineFrom(dress, [])!, unitPrice: "35.000" };
    expect(linePrice(line)).toBe("35.000");
    expect(linePrice({ ...line, variantId: "v-l", unitPrice: undefined })).toBe("42.500");
  });

  it("builds the body without totals and drops gift fields unless it is a gift", () => {
    const form = { ...emptyOrderForm("c1", [lineFrom(dress, [])!]), fee: "2", discount: "1.5", recipientName: "سارة", note: "  " };
    const body = orderBody(form, "instagram");
    expect(body).toMatchObject({ channel: "instagram", deliveryFee: "2.000", discount: "1.500", recipientName: null, note: null, items: [{ variantId: "v-m", quantity: 1 }] });
    expect(body).not.toHaveProperty("total");
    expect(orderBody({ ...form, isGift: true }, "instagram").recipientName).toBe("سارة");
  });
});
