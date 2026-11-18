import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "../Button";
import { Icon } from "../Icon";

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Client-side pre-check only (the server checks the real content). Returns an Arabic message or null. */
export function imageFileProblem(file: File): string | null {
  if (!IMAGE_ACCEPT.split(",").includes(file.type)) {
    return "الصورة لازم تكون JPG أو PNG أو WEBP.";
  }

  return file.size > IMAGE_MAX_BYTES ? "حجم الصورة لازم يكون 5 ميجا أو أقل." : null;
}

interface ImagePickerProps {
  /** Current image URL (already saved), if any. */
  currentUrl?: string | null;
  /** The newly chosen file, or null when cleared. */
  value: File | null;
  onChange: (file: File | null) => void;
  /** Requests removal of the saved image. */
  onRemoveCurrent?: () => void;
  error?: string;
  label?: string;
}

/** Single image chooser with preview. Business-agnostic: the owner decides when to upload. */
export function ImagePicker({ currentUrl, value, onChange, onRemoveCurrent, error, label = "الصورة" }: ImagePickerProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const preview = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const shown = preview ?? currentUrl ?? null;
  const message = problem ?? error;
  return (
    <div className="field image-picker">
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="image-picker__box">
        {shown ? <img src={shown} alt="" className="image-picker__img" /> : <Icon name="photo" size={24} />}
        <div className="col" style={{ gap: 6 }}>
          <Button variant="outline" size="sm" icon="upload" onClick={() => input.current?.click()}>
            {shown ? "غيّر الصورة" : "اختار صورة"}
          </Button>
          {value && (
            <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
              تراجع عن الصورة الجديدة
            </Button>
          )}
          {!value && currentUrl && onRemoveCurrent && (
            <Button variant="ghost" size="sm" icon="trash" onClick={onRemoveCurrent}>
              شيل الصورة
            </Button>
          )}
          <span className="caption">JPG أو PNG أو WEBP · حتى 5 ميجا</span>
        </div>
      </div>
      <input
        ref={input}
        id={inputId}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        aria-invalid={message ? true : undefined}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = "";
          if (!file) {
            return;
          }

          const fileProblem = imageFileProblem(file);
          setProblem(fileProblem);
          if (!fileProblem) {
            onChange(file);
          }
        }}
      />
      {message && (
        <span className="field__error" role="alert">
          {message}
        </span>
      )}
    </div>
  );
}
