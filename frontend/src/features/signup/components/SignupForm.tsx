import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useLocation } from "react-router";
import { applyServerErrors } from "@/shared/lib/formErrors";
import { useCelebrate } from "@/shared/ui/celebrate/CelebrateProvider";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { TextField } from "@/shared/ui/form/TextField";
import { Icon } from "@/shared/ui/Icon";
import { usePublicSignup } from "../api/signupApi";
import { maskEmail, readUtm, signupSchema, type SignupFormValues } from "../domain/signupDomain";
import s from "../landing.module.css";

/** The sign-up form (D-160): name, email, Jordanian mobile, optional store name; the link arrives by email. */
export function SignupForm() {
  const location = useLocation();
  const signup = usePublicSignup();
  const celebrate = useCelebrate();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState, getValues } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", phone: "", storeName: "", website: "" },
  });

  const send = async (values: SignupFormValues, first = true) => {
    setFormError(null);
    try {
      await signup.mutateAsync({
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        storeName: values.storeName.trim() || null,
        website: values.website,
        ...readUtm(location.search),
      });
      setSentTo(values.email.trim());
      if (first) celebrate({ kind: "burst", sticker: "shadda", title: "أهلًا فيك بعيلة لمّة!", text: "الرابط بالطريق لإيميلك" });
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ["fullName", "email", "phone", "storeName"]));
    }
  };

  if (sentTo) {
    return (
      <div className={s.formCard} role="status" aria-live="polite">
        <div className={s.done}>
          <span className={s.doneIcon}>
            <Icon name="circle-check" size={24} />
          </span>
          <h3>تفقّد إيميلك 📬</h3>
          <p className={s.formHint}>
            بعتنالك رابط التسجيل على <bdi className="ltr">{maskEmail(sentTo)}</bdi>. افتحه واختار كلمة السر، وبتبلّش تجربتك المجانية فورًا.
          </p>
          <div className={s.tips}>
            <span>الرابط صالح لمدة 72 ساعة، وبيشتغل مرة وحدة.</span>
            <span>ما لقيته؟ شوف مجلد الرسائل غير المرغوبة (Spam).</span>
          </div>
          <button type="button" className={`${s.cta} ${s.ctaSm}`} disabled={signup.isPending} onClick={() => void send(getValues(), false)}>
            {signup.isPending ? "بنبعت…" : "ابعتلي الرابط كمان مرة"}
          </button>
          <button type="button" className={s.linkBtn} onClick={() => setSentTo(null)}>
            غلطت بالإيميل؟ عدّله
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className={s.formCard} onSubmit={handleSubmit((v) => send(v))} noValidate>
      <h3>ابدأ شهرك المجاني</h3>
      <p className={s.formHint}>بدون بطاقة وبدون التزام. بيوصلك رابط التسجيل على إيميلك خلال لحظات.</p>
      {formError && <FormAlert>{formError}</FormAlert>}
      <TextField label="اسمك" icon="user-circle" autoComplete="name" placeholder="ريم الخطيب" required error={formState.errors.fullName?.message} {...register("fullName")} />
      <TextField label="الإيميل" type="email" ltr autoComplete="email" placeholder="name@example.com" required error={formState.errors.email?.message} {...register("email")} />
      <TextField label="رقم الموبايل" type="tel" ltr icon="phone" inputMode="tel" autoComplete="tel" placeholder="0791234567" required help="عشان نتواصل معك إذا احتجت مساعدة" error={formState.errors.phone?.message} {...register("phone")} />
      <TextField label="اسم متجرك" icon="tag" placeholder="اختياري" error={formState.errors.storeName?.message} {...register("storeName")} />
      <div className={s.honey} aria-hidden="true">
        <label>
          اتركه فاضي
          <input tabIndex={-1} autoComplete="off" {...register("website")} />
        </label>
      </div>
      <button type="submit" className={s.cta} disabled={signup.isPending}>
        {signup.isPending ? "بنبعت الرابط…" : "ابعتلي رابط التسجيل"}
      </button>
      <p className={s.formHint} style={{ textAlign: "center", fontSize: 13 }}>
        بنستخدم بياناتك بس عشان حسابك بلمّة.
      </p>
    </form>
  );
}
