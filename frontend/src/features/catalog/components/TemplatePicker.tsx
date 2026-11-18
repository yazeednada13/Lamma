import { Illustration } from "@/shared/ui/brand/Illustration";
import type { ProductTemplate } from "../api/catalogTypes";
import { templateArt } from "../domain/catalogDomain";

/** Step 1: template cards (prototype `.tpls`). The default follows the business type (D-091). */
export function TemplatePicker({ templates, value, onChange, businessTypeLabel }: { templates: readonly ProductTemplate[]; value: string; onChange: (code: string) => void; businessTypeLabel?: string }) {
  return (
    <section className="card osec is-done" aria-labelledby="pf-tpl">
      <div className="osec__h">
        <span className="osec__n">1</span>
        <h2 id="pf-tpl">قالب المنتج</h2>
        {businessTypeLabel && <span className="caption end">حسب نوع مشروعك: {businessTypeLabel}</span>}
      </div>
      <div className="tpls" role="radiogroup" aria-label="قالب المنتج">
        {templates.map((t) => (
          <button key={t.code} type="button" role="radio" aria-checked={value === t.code} className={`tpl${value === t.code ? " is-active" : ""}`} onClick={() => onChange(t.code)}>
            <Illustration kind="product" template={templateArt(t.code)} />
            {t.nameAr}
            <small>{templateHint(t)}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function templateHint(template: ProductTemplate): string {
  if (template.defaultAxes.length > 0) {
    return template.defaultAxes.map((a) => a.name).join(" و") + (template.supportsExpiry ? " وانتهاء" : "");
  }

  return template.fields.length > 0 ? template.fields.map((f) => f.labelAr).slice(0, 2).join(" و") : "حقولك الخاصة";
}
