import { Button } from "@/shared/ui/Button";
import { TextField } from "@/shared/ui/form/TextField";
import type { ProductTemplate } from "../api/catalogTypes";
import { COLOR_SWATCHES, MAX_AXES, activeAxes, combinations, comboKey, parseQuantity, type Axis } from "../domain/catalogDomain";
import { AxisEditor } from "./AxisEditor";
import type { ProductFormSectionProps } from "./productFormSectionProps";

/** Saved variants of the product being edited, by combination key. */
export type ExistingVariants = ReadonlyMap<string, { onHand: number; isArchived: boolean }>;

interface VariantsSectionProps extends ProductFormSectionProps {
  number: number;
  template: ProductTemplate;
  existing?: ExistingVariants;
  /** False when the axis count is fixed (edit mode, D-093) — names can still be renamed. */
  canChangeAxes: boolean;
  /** Explains why axes cannot be added (e.g. a simple product that holds stock). */
  axesLockedReason?: string;
  /** Stock of a saved simple product (edit mode). */
  simpleStock?: number;
}

/**
 * Step 4: option axes and the quantity matrix (prototype `#secVar`, `.vmatrix`). Every combination of the
 * selected values is a variant; quantities are opening stock (D-096). With no values selected it is a simple product.
 */
export function VariantsSection({ form, number, template, existing, canChangeAxes, axesLockedReason, simpleStock }: VariantsSectionProps) {
  const { watch, setValue, register, formState } = form;
  const axes = watch("axes");
  const quantities = watch("quantities");
  const combos = combinations(axes);
  const active = activeAxes(axes);
  const editing = existing !== undefined;
  const axesError = (formState.errors.axes as { message?: string; root?: { message?: string } } | undefined)?.message ?? formState.errors.axes?.root?.message;
  const axisErrors = formState.errors.axes as unknown as ({ name?: { message?: string } } | undefined)[] | undefined;

  const setAxes = (next: Axis[]) => setValue("axes", next, { shouldDirty: true, shouldValidate: formState.isSubmitted });
  const setQuantity = (key: string, qty: number) => setValue("quantities", { ...quantities, [key]: qty }, { shouldDirty: true });
  const lockedValues = (axisIndex: number) =>
    new Set(editing ? [...existing.keys()].map((k) => k.split("|")[axisIndex] ?? "").filter(Boolean) : []);
  const suggestedFor = (axis: Axis, index: number) => template.defaultAxes.find((a) => a.name === axis.name)?.suggestedValues ?? template.defaultAxes[index]?.suggestedValues ?? [];

  const newCombos = combos.filter((c) => !existing?.has(comboKey(c)));
  const total = combos.reduce((sum, c) => sum + (existing?.get(comboKey(c))?.onHand ?? quantities[comboKey(c)] ?? 0), 0);

  const cell = (values: string[]) => {
    const key = comboKey(values);
    const label = values.join(" · ");
    const saved = existing?.get(key);
    if (saved) {
      return (
        <span key={key} className={`vcell vcell--saved${saved.isArchived ? " is-archived" : ""}`} title={saved.isArchived ? `${label}: مؤرشفة` : `${label}: موجود ${saved.onHand}`}>
          {saved.isArchived ? "—" : saved.onHand}
        </span>
      );
    }

    const qty = quantities[key] ?? 0;
    return (
      <input
        key={key}
        className={`vcell ltr${qty ? " has-qty" : ""}`}
        inputMode="numeric"
        aria-label={label}
        value={qty}
        onChange={(e) => setQuantity(key, parseQuantity(e.target.value))}
      />
    );
  };

  const [first, second] = active;
  return (
    <section className="card osec" aria-labelledby="pf-variants">
      <div className="osec__h">
        <span className="osec__n">{number}</span>
        <h2 id="pf-variants">{active.length > 0 ? active.map((a) => a.name).join(" و") : "الخيارات والمخزون"}</h2>
        {combos.length > 0 && <span className="caption end">{combos.length} نسخة</span>}
      </div>

      <div className="col" style={{ gap: 14 }}>
        {axes.map((axis, i) => (
          <AxisEditor
            key={i}
            axis={axis}
            suggested={suggestedFor(axis, i)}
            lockedValues={lockedValues(i)}
            nameError={axisErrors?.[i]?.name?.message}
            onChange={(next) => setAxes(axes.map((a, j) => (j === i ? next : a)))}
            onRemove={canChangeAxes ? () => setAxes(axes.filter((_, j) => j !== i)) : undefined}
          />
        ))}
        {canChangeAxes && axes.length < MAX_AXES && (
          <div>
            <Button variant="ghost" size="sm" icon="plus" onClick={() => setAxes([...axes, { name: template.defaultAxes[axes.length]?.name ?? "", values: [] }])}>
              أضف خيار (مثلًا المقاس أو اللون)
            </Button>
          </div>
        )}
        {axesLockedReason && <p className="caption">{axesLockedReason}</p>}
        {axesError && (
          <span className="field__error" role="alert">
            {axesError}
          </span>
        )}
      </div>

      {combos.length > 0 && first ? (
        <>
          <div className="vmatrix" style={{ ["--cols" as string]: first.values.length, marginTop: 14 }}>
            <div className="vmatrix__row" style={{ ["--cols" as string]: first.values.length }}>
              <span />
              {first.values.map((v) => (
                <span key={v} className="vmatrix__h">
                  {v}
                </span>
              ))}
            </div>
            {(second ? second.values : [null]).map((rowValue) => (
              <div key={rowValue ?? "single"} className="vmatrix__row" style={{ ["--cols" as string]: first.values.length }}>
                <span className="vmatrix__c">
                  {rowValue && COLOR_SWATCHES[rowValue] && <i style={{ background: COLOR_SWATCHES[rowValue] }} />}
                  {rowValue ?? "الكمية"}
                </span>
                {first.values.map((v) => cell(rowValue ? [v, rowValue] : [v]))}
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <span className="caption grow">
              المجموع <bdi>{total}</bdi> قطعة
              {editing && newCombos.length > 0 && ` · ${newCombos.length} نسخة جديدة`}
            </span>
            {newCombos.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setValue("quantities", { ...quantities, ...Object.fromEntries(newCombos.map((c) => [comboKey(c), 3])) }, { shouldDirty: true })}>
                تعبئة الكل بـ 3
              </Button>
            )}
          </div>
        </>
      ) : simpleStock !== undefined ? (
        <p className="caption" style={{ marginTop: 12 }}>
          المخزون الحالي <bdi>{simpleStock}</bdi> قطعة. تعديل المخزون بيكون من شاشة المخزون (قريبًا).
        </p>
      ) : (
        <div style={{ marginTop: 12, maxWidth: 220 }}>
          <TextField
            label="الكمية الافتتاحية"
            type="number"
            inputMode="numeric"
            min={0}
            ltr
            affix="قطع"
            help="بتتسجّل تلقائي كحركة مخزون"
            error={formState.errors.simpleQuantity?.message}
            {...register("simpleQuantity", { valueAsNumber: true })}
          />
        </div>
      )}
    </section>
  );
}
