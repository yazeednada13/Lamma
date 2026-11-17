import { Illustration } from "@/shared/ui/brand/Illustration";
import { ButtonLink } from "@/shared/ui/Button";

export function NotFoundPage() {
  return (
    <section className="state">
      <Illustration kind="delivery" state="courier" />
      <div className="state__code">404</div>
      <h1>هالصفحة مش بمكانها</h1>
      <p className="muted">المندوب لفّ ولفّ وما لقاها — ممكن الرابط غلط أو الصفحة انحذفت.</p>
      <ButtonLink to="/" size="lg" icon="home">
        رجوع للرئيسية
      </ButtonLink>
    </section>
  );
}
