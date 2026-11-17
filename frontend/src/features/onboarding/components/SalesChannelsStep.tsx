import { channelIcon, channelLabel, channelTone, SALES_CHANNELS, type SalesChannelCode } from "@/features/settings";
import { Button } from "@/shared/ui/Button";
import { FormAlert } from "@/shared/ui/form/FormAlert";
import { Toggle } from "@/shared/ui/form/Toggle";
import { Icon } from "@/shared/ui/Icon";

interface SalesChannelsStepProps {
  selected: readonly SalesChannelCode[];
  error: string | null;
  submitting: boolean;
  onToggle: (channel: SalesChannelCode, on: boolean) => void;
  onBack: () => void;
  onSubmit: () => void;
}

/** Step 3: where orders come from (at least one channel). */
export function SalesChannelsStep({ selected, error, submitting, onToggle, onBack, onSubmit }: SalesChannelsStepProps) {
  return (
    <section className="onb__card">
      <h1>من وين بتجيك الطلبات؟</h1>
      <p className="onb__sub">بنستخدمها عشان نعرفلك أكثر قناة بتبيع. اختار قناة وحدة على الأقل.</p>
      {error && <FormAlert>{error}</FormAlert>}
      <div className="chtoggles">
        {SALES_CHANNELS.map((channel) => {
          const on = selected.includes(channel);
          const id = `ch-${channel}`;
          return (
            <label key={channel} className={`opt${on ? " is-on" : ""}`} htmlFor={id}>
              <span className={`chipi ${channelTone[channel]}`}>
                <Icon name={channelIcon[channel]} />
              </span>
              <span>
                <b>{channelLabel[channel]}</b>
              </span>
              <Toggle id={id} checked={on} onChange={(e) => onToggle(channel, e.target.checked)} aria-label={channelLabel[channel]} />
            </label>
          );
        })}
      </div>
      <div className="row" style={{ marginTop: 22 }}>
        <Button variant="ghost" icon="arrow-right" onClick={onBack}>
          رجوع
        </Button>
        <Button size="lg" className="end" iconEnd="arrow-left" disabled={selected.length === 0} loading={submitting} onClick={onSubmit}>
          جهّز مشروعي
        </Button>
      </div>
    </section>
  );
}
