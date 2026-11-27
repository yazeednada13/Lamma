import { useCurrentAccount } from "@/features/auth";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { ButtonLink } from "@/shared/ui/Button";
import { Icon } from "@/shared/ui/Icon";

/** The prototype's «انتهت التجربة» state (`#/trial-expired`), for any read-only status (D-162). */
export function ReadOnlyPage() {
  const s = useCurrentAccount().business?.subscription;
  const suspended = s?.status === "suspended";
  const trial = s?.status === "trial_ended";
  return (
    <section className="state">
      <Illustration kind="parcel" />
      <span className="overline">{suspended ? "الحساب موقوف" : trial ? "انتهت التجربة المجانية" : "انتهى الاشتراك"}</span>
      <h1>{suspended ? "حسابك موقوف حاليًا" : trial ? "شكرًا إنك جرّبت لمّة 30 يوم" : "اشتراكك خلص"}</h1>
      <p className="muted" style={{ maxWidth: 520 }}>
        {suspended
          ? "تواصل معنا عشان نرجّع الحساب. كل بياناتك محفوظة."
          : "كل طلباتك ومنتجاتك وزباينك محفوظين، وبتقدر تشوفهم وتدوّر فيهم. الإضافة والتعديل بيرجعوا أول ما تشترك."}
      </p>
      <div className="row wrap" style={{ justifyContent: "center", gap: 10 }}>
        {!suspended && (
          <ButtonLink to="/subscription" variant="accent" size="lg">
            اشترك الآن
          </ButtonLink>
        )}
        <ButtonLink to="/orders" variant="outline" size="lg">
          شوف طلباتي
        </ButtonLink>
      </div>
      <div className="row wrap" style={{ gap: 18, justifyContent: "center", marginTop: 8 }}>
        <span className="tag">
          <Icon name="circle-check" size={16} /> بياناتك محفوظة
        </span>
        <span className="tag">
          <Icon name="eye" size={16} /> بتقدر تشوف وتدوّر
        </span>
        <span className="tag tag--sleep">
          <Icon name="lock" size={16} /> {suspended ? "الإضافة لما يرجع الحساب" : "الإضافة بعد الاشتراك"}
        </span>
      </div>
    </section>
  );
}
