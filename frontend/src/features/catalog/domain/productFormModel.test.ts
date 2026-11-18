import { describe, expect, it } from "vitest";
import type { ProductDetails, ProductTemplate } from "../api/catalogTypes";
import { combinations, comboKey, toggleValue } from "./catalogDomain";
import { createBody, emptyFormValues, newVariantBodies, updateBody } from "./productFormModel";

const clothing: ProductTemplate = {
  code: "clothing",
  nameAr: "ملابس",
  supportsExpiry: false,
  supportsGiftBox: false,
  defaultAxes: [
    { name: "المقاس", suggestedValues: ["S", "M", "L"] },
    { name: "اللون", suggestedValues: ["زيتي", "كريمي"] },
  ],
  fields: [{ key: "fabric", labelAr: "الخامة", type: "text", options: [], isRequired: false, isCustom: false }],
};

describe("variant matrix helpers", () => {
  it("builds every combination of the axes with values, in axis order", () => {
    expect(combinations([{ name: "المقاس", values: ["S", "M"] }, { name: "اللون", values: ["زيتي"] }])).toEqual([["S", "زيتي"], ["M", "زيتي"]]);
    expect(combinations([{ name: "المقاس", values: [] }, { name: "اللون", values: ["زيتي"] }])).toEqual([["زيتي"]]);
    expect(combinations([{ name: "المقاس", values: [] }])).toEqual([]);
    expect(comboKey([" M ", "زيتي"])).toBe("m|زيتي");
  });

  it("keeps suggested values in their order when toggled", () => {
    const axis = toggleValue(toggleValue({ name: "المقاس", values: [] }, "L", ["S", "M", "L"]), "S", ["S", "M", "L"]);
    expect(axis.values).toEqual(["S", "L"]);
    expect(toggleValue(axis, "s", ["S", "M", "L"]).values).toEqual(["L"]);
  });
});

describe("product form → API bodies", () => {
  it("a form without values is a simple product with one opening entry", () => {
    const values = { ...emptyFormValues(clothing, 5), name: " كريم ", sellingPrice: "12", cost: "4.5", simpleQuantity: 7, attributes: { fabric: " قطن ", gender: "x" } };

    const body = createBody(values, clothing);

    expect(body).toMatchObject({ name: "كريم", sellingPrice: "12.000", cost: "4.500", options: [], variants: [{ values: [], openingQuantity: 7 }], attributes: { fabric: "قطن" }, expiryDate: null });
  });

  it("a matrix sends every combination with its quantity", () => {
    const values = {
      ...emptyFormValues(clothing, 5),
      name: "فستان",
      sellingPrice: "38",
      cost: "17",
      axes: [
        { name: "المقاس", values: ["S", "M"] },
        { name: "اللون", values: ["زيتي"] },
      ],
      quantities: { "s|زيتي": 3 },
    };

    const body = createBody(values, clothing);

    expect(body.options).toEqual([{ name: "المقاس", values: ["S", "M"] }, { name: "اللون", values: ["زيتي"] }]);
    expect(body.variants).toEqual([{ values: ["S", "زيتي"], openingQuantity: 3 }, { values: ["M", "زيتي"], openingQuantity: 0 }]);
  });

  it("editing adds only new combinations; a simple product converts with the first one", () => {
    const simple = { options: [], variants: [{ values: [], isDefault: true, isArchived: false, onHand: 0 }] } as unknown as ProductDetails;
    const values = { ...emptyFormValues(clothing, 5), name: "x", sellingPrice: "1", cost: "0", axes: [{ name: "المقاس", values: ["S", "M"] }], quantities: { m: 2 } };

    const added = newVariantBodies(values, clothing, simple);

    expect(added).toEqual([
      { values: ["S"], openingQuantity: 0, expiryDate: null, optionNames: ["المقاس"] },
      { values: ["M"], openingQuantity: 2, expiryDate: null },
    ]);
    expect(updateBody(values, clothing, simple).optionNames).toEqual([]);

    const withAxes = { options: [{ name: "المقاس", values: ["S"] }], variants: [{ values: ["S"], isDefault: false, isArchived: false, onHand: 4 }] } as unknown as ProductDetails;
    expect(newVariantBodies({ ...values, axes: [{ name: "القياس", values: ["S", "M"] }] }, clothing, withAxes)).toEqual([{ values: ["M"], openingQuantity: 2, expiryDate: null }]);
    expect(updateBody({ ...values, axes: [{ name: "القياس", values: ["S", "M"] }] }, clothing, withAxes).optionNames).toEqual(["القياس"]);
  });
});
