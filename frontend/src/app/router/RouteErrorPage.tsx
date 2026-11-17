import { useRouteError } from "react-router";
import { ErrorState } from "@/shared/ui/feedback/ErrorState";

/** Last-resort error boundary for render errors (prototype fallback: "صار خلل بتحميل الصفحة"). */
export function RouteErrorPage() {
  const error = useRouteError();
  if (import.meta.env.DEV) {
    console.error(error);
  }

  return (
    <div className="boot">
      <ErrorState message="صار خلل بتحميل الصفحة. حدّث الصفحة وجرّب كمان مرة." onRetry={() => window.location.reload()} />
    </div>
  );
}
