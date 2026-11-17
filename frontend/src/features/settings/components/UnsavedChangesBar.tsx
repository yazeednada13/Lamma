import { Button } from "@/shared/ui/Button";
import { Icon } from "@/shared/ui/Icon";

/** Sticky "unsaved changes" bar (prototype `.dirtybar`): discard or submit the surrounding form. */
export function UnsavedChangesBar({ visible, saving, onDiscard }: { visible: boolean; saving: boolean; onDiscard: () => void }) {
  return (
    <div className={`dirtybar${visible ? " is-on" : ""}`} aria-hidden={!visible}>
      <Icon name="info-circle" />
      <span className="grow">عندك تغييرات ما انحفظت</span>
      <Button variant="ghost" size="sm" style={{ color: "#fff" }} onClick={onDiscard} tabIndex={visible ? 0 : -1}>
        تجاهل
      </Button>
      <Button type="submit" variant="accent" size="sm" loading={saving} tabIndex={visible ? 0 : -1}>
        حفظ
      </Button>
    </div>
  );
}
