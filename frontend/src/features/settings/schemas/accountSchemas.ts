import { z } from "zod";
import { newPasswordSchema } from "@/features/auth";
import { personNameSchema } from "@/shared/validation/fieldSchemas";

export const profileSchema = z.object({ fullName: personNameSchema });
export type ProfileFormValues = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, "اكتب كلمة السر الحالية."), newPassword: newPasswordSchema })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "كلمة السر الجديدة لازم تختلف عن الحالية." });
export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
