import { useId, useState } from "react";
import { Button, IconButton } from "@/shared/ui/Button";
import { COLOR_SWATCHES, MAX_VALUES_PER_AXIS, toggleValue, type Axis } from "../domain/catalogDomain";

interface AxisEditorProps {
  axis: Axis;
  suggested: readonly string[];
  /** Values that already have saved variants (cannot be removed here). */
  lockedValues: ReadonlySet<string>;
  nameError?: string;
  onChange: (axis: Axis) => void;
  onRemove?: () => void;
}

/** One option axis: editable name, suggested values as chips, and custom values (D-093). */
export function AxisEditor({ axis, suggested, lockedValues, nameError, onChange, onRemove }: AxisEditorProps) {
  const id = useId();
  const [custom, setCustom] = useState("");
  const values = [...suggested, ...axis.values.filter((v) => !suggested.includes(v))];
  const isColor = values.some((v) => COLOR_SWATCHES[v]);
  const full = axis.values.length >= MAX_VALUES_PER_AXIS;

  const addCustom = () => {
    const value = custom.trim();
    if (!value || value.length > 40 || full) return;
    if (!axis.values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      onChange(toggleValue(axis, value, suggested));
    }
    setCustom("");
  };

  return (
    <div className="axis-editor">
      <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
        <div className="field grow">
          <label className="field__label" htmlFor={`${id}-name`}>
            اسم الخيار
          </label>
          <span className={`control${nameError ? " is-error" : ""}`} style={{ height: 40 }}>
            <input id={`${id}-name`} value={axis.name} maxLength={30} onChange={(e) => onChange({ ...axis, name: e.target.value })} aria-invalid={nameError ? true : undefined} />
          </span>
          {nameError && (
            <span className="field__error" role="alert">
              {nameError}
            </span>
          )}
        </div>
        {onRemove && <IconButton icon="trash" label={`شيل خيار ${axis.name || ""}`.trim()} size="sm" onClick={onRemove} />}
      </div>
      <div className="row wrap" style={{ gap: 6, margin: "8px 0 4px" }} role="group" aria-label={`قيم ${axis.name || "الخيار"}`}>
        {values.map((value) => {
          const on = axis.values.includes(value);
          const locked = lockedValues.has(value.toLowerCase());
          const swatch = COLOR_SWATCHES[value];
          return (
            <button
              key={value}
              type="button"
              className={`${isColor ? "chip" : "swatch"}${on ? " is-selected" : ""}`}
              aria-pressed={on}
              disabled={locked && on}
              title={locked && on ? "إلها نسخ محفوظة" : undefined}
              onClick={() => (on || !full) && onChange(toggleValue(axis, value, suggested))}
            >
              {swatch && <i className="swatch-dot" style={{ background: swatch }} />}
              {value}
            </button>
          );
        })}
      </div>
      <div className="row" style={{ gap: 6 }}>
        <span className="control" style={{ height: 36, maxWidth: 220 }}>
          <input
            value={custom}
            maxLength={40}
            placeholder="قيمة جديدة"
            aria-label={`أضف قيمة لـ ${axis.name || "الخيار"}`}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
          />
        </span>
        <Button variant="ghost" size="sm" icon="plus" onClick={addCustom} disabled={!custom.trim() || full}>
          أضف
        </Button>
        {full && <span className="caption">وصلت الحد ({MAX_VALUES_PER_AXIS} قيمة)</span>}
      </div>
    </div>
  );
}
