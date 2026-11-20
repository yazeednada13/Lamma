// Public API of the settings feature. Other code imports from "@/features/settings" only.
export { createSettingsRoutes } from "./routes";
export { useBusinessSettings, usePaymentMethodSettings, useSalesChannelSettings, type SalesChannelSettings } from "./api/businessSettingsApi";
export { useBusinessTypeLabel, useBusinessTypes, type BusinessTypeOption } from "./api/businessTypesApi";
export { SALES_CHANNELS, channelIcon, channelLabel, channelTone, type SalesChannelCode } from "./domain/salesChannels";
export { PAYMENT_METHODS, paymentMethodLabel, type PaymentMethodCode } from "./domain/paymentMethods";
export { businessTypeInfo } from "./domain/businessTypes";
export { SettingsGroup } from "./components/SettingsGroup";
export type { SettingsExtraSection, SettingsSection } from "./components/SettingsSectionNav";
