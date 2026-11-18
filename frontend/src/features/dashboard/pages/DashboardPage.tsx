import { useCurrentAccount } from "@/features/auth";
import { channelLabel, useBusinessTypeLabel, useSalesChannelSettings } from "@/features/settings";
import { firstName } from "@/shared/lib/personName";
import { ButtonLink } from "@/shared/ui/Button";
import { EmptyState } from "@/shared/ui/feedback/EmptyState";
import { Icon } from "@/shared/ui/Icon";
import { PageHeader } from "@/shared/ui/PageHeader";

/** New-user dashboard (prototype `#/dashboard-new`). Every figure here is real; nothing is fabricated. */
export function DashboardPage() {
  const account = useCurrentAccount();
  const channels = useSalesChannelSettings();
  const business = account.business!;
  const businessTypeLabel = useBusinessTypeLabel(business.businessType);
  const enabledChannels = channels.data?.channels.filter((c) => c.isEnabled).map((c) => channelLabel[c.channel]) ?? [];
  const steps = 4;
  const done = 1;

  return (
    <>
      <PageHeader title={`أهلًا فيك بلمّة يا ${firstName(account.fullName)}`} subtitle="خطوات قليلة وبكون كل شغلك بمكانه" />
      <div className="grid g-main">
        <div className="card">
          <div className="row" style={{ gap: 16, marginBottom: 8 }}>
            <div className="ring" style={{ ["--p" as string]: Math.round((done / steps) * 100) }}>
              <span>
                <bdi>
                  {done}/{steps}
                </bdi>
              </span>
            </div>
            <div>
              <h3>ابدأ هون</h3>
              <p className="muted">كل خطوة بتاخد أقل من دقيقة</p>
            </div>
          </div>
          <ul className="checklist">
            <li>
              <span className="done">
                <Icon name="check" size={16} />
              </span>
              <span className="grow">
                <b>جهّز مشروعك</b>
                <br />
                <span className="caption">
                  {businessTypeLabel}
                  {enabledChannels.length > 0 && ` · ${enabledChannels.join(" و")}`}
                </span>
              </span>
              <ButtonLink to="/settings" variant="ghost" size="sm">
                عدّل
              </ButtonLink>
            </li>
            <li>
              <span className="todo" />
              <span className="grow">
                <b>أضف أول منتج</b>
                <br />
                <span className="caption">بالمقاسات والألوان وكمية كل وحدة</span>
              </span>
              <ButtonLink to="/products/new" size="sm">
                أضف منتج
              </ButtonLink>
            </li>
            <li>
              <span className="todo" />
              <span className="grow">
                <b>سجّل أول طلب</b>
                <br />
                <span className="caption">من رسالة واتساب أو إنستغرام</span>
              </span>
              <ButtonLink to="/orders/new" variant="outline" size="sm">
                سجّل طلب
              </ButtonLink>
            </li>
            <li>
              <span className="todo" />
              <span className="grow">
                <b>سجّل مصروف</b>
                <br />
                <span className="caption">عشان نحسبلك الربح الحقيقي</span>
              </span>
              <ButtonLink to="/finance/expenses" variant="outline" size="sm">
                سجّل مصروف
              </ButtonLink>
            </li>
          </ul>
        </div>
        <EmptyState title="هون رح تشوف «لمّة اليوم»" text="أول ما تسجّل طلبات، بنجمعلك كل شي بجملة وحدة كل يوم." />
      </div>
    </>
  );
}
