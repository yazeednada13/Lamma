import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { applyServerErrors } from "@/shared/lib/formErrors";
import { Button } from "@/shared/ui/Button";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { TextField } from "@/shared/ui/form/TextField";
import { Icon } from "@/shared/ui/Icon";
import { useForgotPassword } from "../api/authApi";
import { AuthLayout } from "../components/AuthLayout";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "../schemas/authSchemas";

export function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    try {
      await forgot.mutateAsync({ email });
      setSentTo(email);
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["email"]));
    }
  });

  return (
    <AuthLayout title="ولا يهمك" subtitle="بنبعتلك رابط على إيميلك تغيّر فيه كلمة السر، وبترجع لشغلك خلال دقيقة.">
      <form className="auth2__card" onSubmit={onSubmit} noValidate>
        <h1>استعادة كلمة السر</h1>
        {sentTo ? (
          <FormAlert tone="success">إذا الإيميل {sentTo} مسجّل عنا، بعتنالك رابط تغيّر فيه كلمة السر. شيّك إيميلك.</FormAlert>
        ) : (
          <>
            <p className="muted">اكتب الإيميل اللي سجّلت فيه.</p>
            {formError && <FormAlert>{formError}</FormAlert>}
            <TextField label="الإيميل" type="email" ltr autoComplete="email" error={formState.errors.email?.message} {...register("email")} />
            <Button type="submit" size="lg" loading={forgot.isPending}>
              أرسل الرابط
            </Button>
          </>
        )}
        <Link to="/login" className="muted row" style={{ gap: 6 }}>
          <Icon name="arrow-right" size={16} /> رجوع لتسجيل الدخول
        </Link>
      </form>
    </AuthLayout>
  );
}
