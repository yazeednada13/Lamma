import { z } from "zod";

/** Business settings form: profile, enabled channels and methods (code → enabled), inventory default. */
export const businessSettingsSchema = z.object({
  name: z.string().trim().min(1, "اسم المشروع مطلوب.").max(100, "اسم المشروع لازم يكون 100 حرف أو أقل."),
  businessType: z.string().min(1),
  defaultLowStockThreshold: z
    .number({ message: "اكتب رقم صحيح." })
    .int("اكتب رقم صحيح بدون كسور.")
    .min(0, "الحد لازم يكون بين 0 و 1000.")
    .max(1000, "الحد لازم يكون بين 0 و 1000."),
  channels: z.record(z.string(), z.boolean()).refine((c) => Object.values(c).some(Boolean), "لازم تفعّل قناة بيع وحدة على الأقل."),
  methods: z.record(z.string(), z.boolean()).refine((m) => Object.values(m).some(Boolean), "لازم تفعّل طريقة دفع وحدة على الأقل."),
});

export type BusinessSettingsFormValues = z.infer<typeof businessSettingsSchema>;
