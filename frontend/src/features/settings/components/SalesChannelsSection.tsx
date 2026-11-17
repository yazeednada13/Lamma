import { Toggle } from "@/shared/ui/form/Toggle";
import { Icon } from "@/shared/ui/Icon";
import { channelIcon, channelLabel, SALES_CHANNELS } from "../domain/salesChannels";
import { recordErrorMessage, type BusinessSettingsSectionProps } from "./businessSettingsSectionProps";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";

/** Enable/disable each sales channel (at least one must stay on). */
export function SalesChannelsSection({ register, errors }: BusinessSettingsSectionProps) {
  const error = recordErrorMessage(errors.channels);
  return (
    <SettingsGroup id="sc" icon="brand-instagram" tone="tone-apricot" title="قنوات البيع" subtitle="من وين بتجيك الطلبات">
      {SALES_CHANNELS.map((channel) => (
        <SettingsRow
          key={channel}
          htmlFor={`set-ch-${channel}`}
          title={
            <span className="row" style={{ gap: 8 }}>
              <Icon name={channelIcon[channel]} /> {channelLabel[channel]}
            </span>
          }
        >
          <Toggle id={`set-ch-${channel}`} aria-label={channelLabel[channel]} {...register(`channels.${channel}`)} />
        </SettingsRow>
      ))}
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </SettingsGroup>
  );
}
