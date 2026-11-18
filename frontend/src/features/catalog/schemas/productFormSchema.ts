import { z } from "zod";
import { parseMoneyInput, toFils } from "@/shared/lib/money";
import { MAX_AXES, MAX_VALUES_PER_AXIS, MAX_VARIANTS, combinations } from "../domain/catalogDomain";

const money = (requiredMessage: string, allowZero: boolean) =>
  z
    .string()
    .trim()
    .min(1, requiredMessage)
    .refine((v) => parseMoneyInput(v) !== null, "اكتب مبلغ صحيح، بخانتين عشريتين كحد أقصى.")
    .refine((v) => {
      const parsed = parseMoneyInput(v);
      if (parsed === null) return true;
      const fils = toFils(parsed);
      return (allowZero ? fils >= 0 : fils > 0) && fils <= 999_999_990;
    }, allowZero ? "التكلفة لازم تكون صفر أو أكثر." : "السعر لازم يكون أكبر من صفر.");

/**
 * Product form (mirrors the server rules of CreateProductRequest/UpdateProductRequest, D-093, D-097).
 * Axes without values are ignored, so a product with no selected values is a simple product (D-090).
 */
export const productFormSchema = z
  .object({
    templateCode: z.string().min(1),
    name: z.string().trim().min(1, "اسم المنتج مطلوب.").max(120, "اسم المنتج لازم يكون 120 حرف أو أقل."),
    sellingPrice: money("سعر البيع مطلوب.", false),
    cost: money("التكلفة مطلوبة، اكتب 0 إذا ما في تكلفة.", true),
    categoryId: z.string(),
    lowStockThreshold: z.number({ message: "اكتب رقم صحيح." }).int("اكتب رقم صحيح بدون كسور.").min(0, "الحد لازم يكون بين 0 و 1000.").max(1000, "الحد لازم يكون بين 0 و 1000."),
    attributes: z.record(z.string(), z.string()),
    expiryDate: z.string(),
    axes: z
      .array(
        z.object({
          name: z.string().max(30, "اسم الخيار لازم يكون 30 حرف أو أقل."),
          values: z.array(z.string().trim().min(1).max(40, "القيمة لازم تكون 40 حرف أو أقل.")).max(MAX_VALUES_PER_AXIS, `الحد الأقصى ${MAX_VALUES_PER_AXIS} قيمة لكل خيار.`),
        }),
      )
      .max(MAX_AXES),
    quantities: z.record(z.string(), z.number().int().min(0)),
    simpleQuantity: z.number().int().min(0, "الكمية لازم تكون صفر أو أكثر.").max(100_000, "الكمية كبيرة كثير."),
  })
  .superRefine((values, ctx) => {
    values.axes.forEach((axis, i) => {
      if (axis.values.length > 0 && !axis.name.trim()) {
        ctx.addIssue({ code: "custom", path: ["axes", i, "name"], message: "اكتب اسم الخيار (مثلًا المقاس)." });
      }
    });

    const names = values.axes.filter((a) => a.values.length > 0).map((a) => a.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: "custom", path: ["axes"], message: "في خيار مكرر." });
    }

    if (combinations(values.axes).length > MAX_VARIANTS) {
      ctx.addIssue({ code: "custom", path: ["axes"], message: `الحد الأقصى ${MAX_VARIANTS} نسخة للمنتج.` });
    }
  });

export type ProductFormValues = z.infer<typeof productFormSchema>;
