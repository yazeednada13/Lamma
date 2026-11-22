import { describe, expect, it } from "vitest";
import { byDay, calendarCells, depositShortcut, returnable, returnPreview } from "./returnModel";

const order = (returnedQuantity: number, returnedAmount: string, paid: string) =>
  ({
    items: [{ id: "a", quantity: 3, returnedQuantity, unitPrice: "10.000" }],
    itemsSubtotal: "30.000",
    discount: "1.000",
    total: "31.000",
    returnedAmount,
    paid,
  }) as unknown as Parameters<typeof returnPreview>[0];

describe("return math like the server (D-148)", () => {
  it("first piece of a paid order: the refund is forced to 9.67", () => {
    expect(returnPreview(order(0, "0.000", "31.000"), { a: 1 })).toEqual({
      value: "9.670",
      netAfter: "21.330",
      minRefund: "9.670",
      maxRefund: "9.670",
    });
  });

  it("the rest removes exactly the discount; the fee stays", () => {
    expect(returnPreview(order(1, "9.670", "21.330"), { a: 2 })).toEqual({
      value: "19.330",
      netAfter: "2.000",
      minRefund: "19.330",
      maxRefund: "19.330",
    });
  });

  it("partly paid or unpaid orders need no refund", () => {
    expect(returnPreview(order(0, "0.000", "15.000"), { a: 1 })).toMatchObject({
      minRefund: "0.000",
      maxRefund: "9.670",
    });
    expect(returnPreview(order(0, "0.000", "0.000"), { a: 1 })).toMatchObject({
      minRefund: "0.000",
      maxRefund: "0.000",
    });
    expect(returnable({ quantity: 3, returnedQuantity: 1 })).toBe(2);
  });
});

describe("pre-order calendar (D-151)", () => {
  it("places dates under their weekday, Saturday first", () => {
    const cells = calendarCells("2026-11-22", 3); // a Sunday
    expect(cells).toEqual([null, "2026-11-22", "2026-11-23", "2026-11-24"]);
    expect(calendarCells("2026-11-21", 1)).toEqual(["2026-11-21"]); // Saturday, no blank
  });

  it("groups by day and offers a 30% deposit", () => {
    const groups = byDay([{ expectedDeliveryOn: "2026-11-24" }, { expectedDeliveryOn: "2026-11-24" }] as never);
    expect(groups.get("2026-11-24")).toHaveLength(2);
    expect(depositShortcut("31.000")).toBe("9.300");
    expect(depositShortcut("10.010")).toBe("3.000");
  });
});
