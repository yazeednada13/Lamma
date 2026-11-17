import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useSearchParams } from "react-router";
import { ApiError } from "@/services/api/apiClient";
import { applyServerErrors } from "@/shared/lib/formErrors";
import { Button } from "@/shared/ui/Button";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { PasswordField } from "@/shared/ui/form/PasswordField";
import { PasswordStrength } from "@/shared/ui/form/PasswordStrength";
import { useResetPassword } from "../api/authApi";
import { AuthLayout } from "../components/AuthLayout";
import { resetPasswordSchema, type ResetPasswordFormValues } from "../schemas/authSchemas";

/** Reset password from the emailed link (`?email=…&token=…`). */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const token = params.get("token") ?? "";
  const reset = useResetPassword();
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState, control } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "" },
  });
  const newPasswordValue = useWatch({ control, name: "newPassword" });

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    setFormError(null);
    try {
      await reset.mutateAsync({ email, token, newPassword });
      setDone(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === "auth.invalid_token") {
        setFormError(error.message);
        return;
      }

      setFormError(applyServerErrors(error, setError, ["newPassword"]));
    }
  });

  const linkBroken = !email || !token;

  return (
    <AuthLayout title="كلمة سر جديدة" subtitle="اختار كلمة سر جديدة وارجع لشغلك.">
      <form className="auth2__card" onSubmit={onSubmit} noValidate>
        <h1>تغيير كلمة السر</h1>
        {linkBroken ? (
          <FormAlert>رابط الاستعادة ناقص أو غلط. اطلب رابط جديد.</FormAlert>
        ) : done ? (
          <FormAlert tone="success">تغيّرت كلمة السر. سجّل دخول بالكلمة الجديدة.</FormAlert>
        ) : (
          <>
            <p className="muted ltr">{email}</p>
            {formError && <FormAlert>{formError}</FormAlert>}
            <PasswordField label="كلمة السر الجديدة" autoComplete="new-password" error={formState.errors.newPassword?.message} {...register("newPassword")} />
            <PasswordStrength password={newPasswordValue} />
            <Button type="submit" size="lg" loading={reset.isPending}>
              حفظ كلمة السر
            </Button>
          </>
        )}
        {linkBroken ? <Link to="/forgot-password">اطلب رابط جديد</Link> : <Link to="/login">رجوع لتسجيل الدخول</Link>}
      </form>
    </AuthLayout>
  );
}
