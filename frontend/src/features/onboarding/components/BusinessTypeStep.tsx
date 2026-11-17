import { businessTypeInfo } from "@/features/settings";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { Button } from "@/shared/ui/Button";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import type { BusinessTypeOption } from "../api/onboardingApi";

interface BusinessTypeStepProps {
  options: readonly BusinessTypeOption[];
  loadError?: string;
  selected: string | null;
  onSelect: (code: string) => void;
  onBack: () => void;
  onContinue: () => void;
}

/** Step 2: pick exactly one of the 13 business types (D-081). */
export function BusinessTypeStep({ options, loadError, selected, onSelect, onBack, onContinue }: BusinessTypeStepProps) {
  return (
    <section className="onb__card">
      <h1>شو بتبيع؟</h1>
      <p className="onb__sub">بنجهّزلك حقول المنتجات حسب نوع مشروعك. كل منتج بتقدر تختارله قالب مختلف بعدين.</p>
      {loadError ? (
        <FormAlert>{loadError}</FormAlert>
      ) : (
        <div className="btypes" role="radiogroup" aria-label="نوع المشروع">
          {options.map((option) => {
            const info = businessTypeInfo[option.code];
            const isSelected = selected === option.code;
            return (
              <button type="button" key={option.code} className={`btype${isSelected ? " is-on" : ""}`} role="radio" aria-checked={isSelected} onClick={() => onSelect(option.code)}>
                <Illustration kind="product" template={info?.art ?? "other"} />
                <b>{option.labelAr}</b>
                {info && <span>{info.hint}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div className="row" style={{ marginTop: 22 }}>
        <Button variant="ghost" icon="arrow-right" onClick={onBack}>
          رجوع
        </Button>
        <Button size="lg" className="end" iconEnd="arrow-left" disabled={!selected} onClick={onContinue}>
          متابعة
        </Button>
      </div>
    </section>
  );
}
