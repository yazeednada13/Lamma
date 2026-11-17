// Public API of the settings feature. Other code imports from "@/features/settings" only.
export { settingsRoutes } from "./routes";
export { useSalesChannelSettings, type SalesChannelSettings } from "./api/businessSettingsApi";
export { SALES_CHANNELS, channelIcon, channelLabel, channelTone, type SalesChannelCode } from "./domain/salesChannels";
export { PAYMENT_METHODS, paymentMethodLabel, type PaymentMethodCode } from "./domain/paymentMethods";
export { businessTypeInfo, businessTypeLabel } from "./domain/businessTypes";
