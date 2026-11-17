import type { IconName } from "@/shared/ui/Icon";

// Sales channels (D-022): API codes and how they are shown. Owned by business settings.

export type SalesChannelCode = "instagram" | "whatsapp" | "facebook" | "other";

export const SALES_CHANNELS: readonly SalesChannelCode[] = ["instagram", "whatsapp", "facebook", "other"];

export const channelLabel: Record<SalesChannelCode, string> = {
  instagram: "إنستغرام",
  whatsapp: "واتساب",
  facebook: "فيسبوك",
  other: "أخرى",
};

export const channelIcon: Record<SalesChannelCode, IconName> = {
  instagram: "brand-instagram",
  whatsapp: "brand-whatsapp",
  facebook: "brand-facebook",
  other: "phone",
};

export const channelTone: Record<SalesChannelCode, string> = {
  instagram: "tone-apricot",
  whatsapp: "tone-green",
  facebook: "tone-blue",
  other: "tone-olive",
};
