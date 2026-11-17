import { Illustration } from "@/shared/ui/brand/Illustration";
import { ButtonLink } from "@/shared/ui/Button";
import { PageHeader } from "@/shared/ui/PageHeader";

/** Shared page for modules planned in later phases (D-085). No fake data. */
export function ComingSoonPage({ title, phase }: { title: string; phase: number }) {
  return (
    <>
      <PageHeader title={title} />
      <section className="state" aria-labelledby="soon-title">
        <Illustration kind="parcel" />
        <span className="overline">قريبًا</span>
        <h1 id="soon-title">هذا القسم قيد التطوير</h1>
        <p className="muted">«{title}» رح يكون جاهز بمرحلة جاية من لمّة (المرحلة {phase}). بياناتك ومشروعك محفوظين.</p>
        <ButtonLink to="/" size="lg" icon="home">
          رجوع للرئيسية
        </ButtonLink>
      </section>
    </>
  );
}
