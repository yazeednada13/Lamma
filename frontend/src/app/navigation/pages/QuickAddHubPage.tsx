import { PageHeader } from "@/shared/ui/PageHeader";
import { QUICK_ADD } from "../navigation";
import { NavTiles } from "../NavTiles";

/** Mobile "+" hub (prototype `#/new`). */
export function QuickAddHubPage() {
  return (
    <>
      <PageHeader title="شو بدك تضيف؟" />
      <NavTiles items={QUICK_ADD} />
    </>
  );
}
