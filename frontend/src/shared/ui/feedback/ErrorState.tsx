import { Button } from "../Button";
import { Icon } from "../Icon";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card empty" role="alert">
      <span className="chipi tone-brick" style={{ width: 56, height: 56, borderRadius: 18 }}>
        <Icon name="cloud-off" size={24} />
      </span>
      <div className="empty__title">ما قدرنا نحمّل الصفحة</div>
      <p className="muted">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          جرّب كمان مرة
        </Button>
      )}
    </div>
  );
}
