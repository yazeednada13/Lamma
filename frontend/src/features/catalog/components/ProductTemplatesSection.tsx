import { useState } from "react";
import { SettingsGroup } from "@/features/settings";
import { errorMessage } from "@/services/api/apiClient";
import { Badge } from "@/shared/ui/Badge";
import { Illustration } from "@/shared/ui/brand/Illustration";
import { Button, IconButton } from "@/shared/ui/Button";
import { Skeleton } from "@/shared/ui/feedback/Skeleton";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { useToast } from "@/shared/ui/toast/ToastProvider";
import { useDeleteTemplateField, useProductTemplates, useSaveTemplateField } from "../api/catalogApi";
import type { TemplateField } from "../api/catalogTypes";
import { templateArt } from "../domain/catalogDomain";
import { TemplateFieldDrawer, fieldTypeLabel } from "./TemplateFieldDrawer";

/**
 * Settings → "القوالب والحقول الخاصة" (prototype `stpl`). System templates are fixed; the business adds its own
 * fields to any template (D-092). Composed into the settings page by the app layer.
 */
export function ProductTemplatesSection() {
  const templates = useProductTemplates();
  const save = useSaveTemplateField();
  const remove = useDeleteTemplateField();
  const toast = useToast();
  const [selected, setSelected] = useState("clothing");
  const [drawer, setDrawer] = useState<TemplateField | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const template = templates.data?.find((t) => t.code === selected) ?? templates.data?.[0];
  return (
    <SettingsGroup id="stpl" icon="palette" tone="tone-olive" title="القوالب والحقول الخاصة" subtitle="حقول إضافية لمنتجاتك">
      {templates.error ? (
        <FormAlert>{errorMessage(templates.error)}</FormAlert>
      ) : !templates.data || !template ? (
        <Skeleton height={120} />
      ) : (
        <>
          <div className="tpls" role="radiogroup" aria-label="القوالب">
            {templates.data.map((t) => (
              <button key={t.code} type="button" role="radio" aria-checked={t.code === template.code} className={`tpl${t.code === template.code ? " is-active" : ""}`} onClick={() => setSelected(t.code)}>
                <Illustration kind="product" template={templateArt(t.code)} />
                {t.nameAr}
                <small>{t.fields.filter((f) => f.isCustom).length > 0 ? `${t.fields.filter((f) => f.isCustom).length} حقول خاصة` : "مفعّل"}</small>
              </button>
            ))}
          </div>
          {error && <FormAlert>{error}</FormAlert>}
          <ul className="field-list" aria-label={`حقول قالب ${template.nameAr}`}>
            {template.fields.length === 0 && <li className="muted">ما في حقول لهذا القالب. أضف حقولك الخاصة.</li>}
            {template.fields.map((f) => (
              <li key={f.key} className="row" style={{ gap: 8 }}>
                <span className="grow">
                  <b>{f.labelAr}</b> <span className="caption">· {fieldTypeLabel[f.type]}</span>
                  {f.isRequired && <span className="caption"> · مطلوب</span>}
                </span>
                {f.isCustom ? (
                  <>
                    <IconButton icon="pencil" size="sm" label={`تعديل ${f.labelAr}`} onClick={() => setDrawer(f)} />
                    <IconButton
                      icon="trash"
                      size="sm"
                      label={`حذف ${f.labelAr}`}
                      onClick={async () => {
                        setError(null);
                        try {
                          await remove.mutateAsync({ templateCode: template.code, key: f.key });
                          toast(`انحذف حقل «${f.labelAr}»`);
                        } catch (e) {
                          setError(errorMessage(e));
                        }
                      }}
                    />
                  </>
                ) : (
                  <Badge tone="outline">من لمّة</Badge>
                )}
              </li>
            ))}
          </ul>
          <div>
            <Button variant="outline" size="sm" icon="plus" onClick={() => setDrawer("new")}>
              حقل خاص
            </Button>
          </div>
          <TemplateFieldDrawer
            target={drawer}
            templateName={template.nameAr}
            saving={save.isPending}
            onClose={() => setDrawer(null)}
            onSave={async (body) => {
              await save.mutateAsync({ templateCode: template.code, key: drawer === "new" ? undefined : drawer?.key, body });
              toast(drawer === "new" ? `انضاف حقل «${body.labelAr}»` : "انحفظ الحقل");
              setDrawer(null);
            }}
          />
        </>
      )}
    </SettingsGroup>
  );
}
