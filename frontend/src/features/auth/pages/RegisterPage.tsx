import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ApiError, errorMessage } from "@/services/api/apiClient";
import { applyServerErrors } from "@/shared/lib/formErrors";
import { Button, ButtonLink } from "@/shared/ui/Button";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { PasswordField } from "@/shared/ui/form/PasswordField";
import { PasswordStrength } from "@/shared/ui/form/PasswordStrength";
import { TextField } from "@/shared/ui/form/TextField";
import { Icon } from "@/shared/ui/Icon";
import { useInvitation, useRegister } from "../api/authApi";
import { AuthLayout } from "../components/AuthLayout";
import { registerSchema, type RegisterFormValues } from "../schemas/authSchemas";

const LINK_PROBLEMS = new Set(["invite.invalid", "invite.expired"]);

/** Registration from the emailed link (`/register?token=…`, D-160): name and email locked, the owner picks a password. */
export function RegisterPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const invitation = useInvitation(token);
  const registerAccount = useRegister();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [linkProblem, setLinkProblem] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState, control } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });
  const password = useWatch({ control, name: "password" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerAccount.mutateAsync({ token, ...values });
      navigate("/onboarding", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && LINK_PROBLEMS.has(error.code)) {
        setLinkProblem(error.message);
        return;
      }

      setFormError(applyServerErrors(error, setError, ["password", "confirmPassword"]));
    }
  });

  const layout = (body: ReactNode) => (
    <AuthLayout
      title={
        <>
          ضلّت <em>خطوة وحدة</em>
        </>
      }
      subtitle="اختار كلمة السر، وبتبلّش تجربتك المجانية لمدة شهر كامل بكل المزايا."
    >
      {body}
    </AuthLayout>
  );

  const problem =
    linkProblem ??
    (!token
      ? "الرابط ناقص. افتح الرابط من الإيميل كما هو، أو عبّي النموذج من جديد."
      : invitation.error instanceof ApiError && LINK_PROBLEMS.has(invitation.error.code)
        ? invitation.error.message
        : null);

  if (problem) {
    return layout(
      <div className="auth2__card">
        <h1>الرابط ما بيشتغل</h1>
        <FormAlert>{problem}</FormAlert>
        <ButtonLink to="/#join" size="lg" iconEnd="arrow-left">
          ابعتلي رابط جديد
        </ButtonLink>
        <p className="muted" style={{ textAlign: "center" }}>
          سجّلت قبل؟ <Link to="/login">سجّل دخول</Link>
        </p>
      </div>,
    );
  }

  if (invitation.error) {
    return layout(
      <div className="auth2__card">
        <FormAlert>{errorMessage(invitation.error)}</FormAlert>
        <Button variant="outline" onClick={() => void invitation.refetch()}>
          جرّب كمان مرة
        </Button>
      </div>,
    );
  }

  const inv = invitation.data;
  if (!inv) {
    return layout(
      <div className="auth2__card" role="status" aria-live="polite">
        <p className="muted">بنتأكد من الرابط…</p>
      </div>,
    );
  }

  return layout(
    <form className="auth2__card" onSubmit={onSubmit} noValidate>
      <h1>أهلًا {inv.fullName.split(" ")[0]} 👋</h1>
      <p className="muted">مبروك، صرت من عيلة لمّة. اختار كلمة سر لحسابك.</p>
      {formError && <FormAlert>{formError}</FormAlert>}
      <TextField label="الاسم" icon="user-circle" value={inv.fullName} readOnly disabled />
      <TextField
        label="الإيميل"
        type="email"
        ltr
        value={inv.email}
        readOnly
        disabled
        trailing={<Icon name="lock" size={16} />}
        help="الإيميل مربوط بالرابط وما بيتغيّر"
      />
      <PasswordField label="كلمة السر" placeholder="8 خانات على الأقل" autoComplete="new-password" help="8 أحرف على الأقل، وفيها حرف ورقم" required error={formState.errors.password?.message} {...register("password")} />
      <PasswordStrength password={password} />
      <PasswordField label="تأكيد كلمة السر" autoComplete="new-password" required error={formState.errors.confirmPassword?.message} {...register("confirmPassword")} />
      <Button type="submit" size="lg" loading={registerAccount.isPending} iconEnd="arrow-left">
        ابدأ تجربتي المجانية
      </Button>
      <p className="caption" style={{ textAlign: "center" }}>
        بإنشاء الحساب بتوافق على الشروط وسياسة الخصوصية
      </p>
    </form>,
  );
}
