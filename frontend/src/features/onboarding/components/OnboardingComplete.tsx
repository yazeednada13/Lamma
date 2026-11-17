import { Illustration } from "@/shared/ui/brand/Illustration";
import { Button } from "@/shared/ui/Button";

interface OnboardingCompleteProps {
  businessName: string;
  templateLabel: string;
  trialDays: number;
  onEnter: () => void;
}

/** The "everything is in its place" screen shown after the business is created. */
export function OnboardingComplete({ businessName, templateLabel, trialDays, onEnter }: OnboardingCompleteProps) {
  return (
    <section className="onb__card onb__done">
      <Illustration kind="gather" play />
      <h1>كل شي صار بمكانه</h1>
      <p className="onb__sub">
        جهّزنا مشروع «{businessName}» بقالب {templateLabel}، وبلّشت تجربتك المجانية — {trialDays} يوم.
      </p>
      <Button size="lg" iconEnd="arrow-left" onClick={onEnter}>
        ادخل على لمّة
      </Button>
    </section>
  );
}
