import type { ProductArt } from "@/assets/illustrations/lammaArt";

// The 13 business types (D-009). Labels match the API's catalog; hints and art come from the approved prototype.
// Note: the API also returns Arabic labels (onboarding uses those); this client copy is tracked as OQ-091.

export const businessTypeInfo: Record<string, { label: string; hint: string; art: ProductArt }> = {
  clothing: { label: "ملابس وأزياء", hint: "مقاسات وألوان", art: "clothing" },
  shoes_bags: { label: "أحذية وشنط", hint: "مقاس الحذاء", art: "other" },
  perfume: { label: "عطور", hint: "الحجم بالمل", art: "perfume" },
  beauty: { label: "تجميل وعناية", hint: "درجات وانتهاء", art: "beauty" },
  accessories: { label: "إكسسوارات ومجوهرات", hint: "خامة ووزن", art: "jewelry" },
  gifts: { label: "هدايا وبوكسات", hint: "بوكسات وإهداء", art: "gift" },
  home_food: { label: "أكل وحلويات بيتية", hint: "طلبات مسبقة", art: "other" },
  handmade: { label: "شغل يدوي", hint: "حسب الطلب وعربون", art: "other" },
  electronics: { label: "إلكترونيات", hint: "التوافق والكفالة", art: "other" },
  kids: { label: "أطفال وألعاب", hint: "العمر والمقاس", art: "clothing" },
  home_decor: { label: "ديكور ومنزل", hint: "الأبعاد", art: "other" },
  books: { label: "كتب وقرطاسية", hint: "المؤلف", art: "other" },
  other: { label: "أخرى", hint: "حقولك الخاصة", art: "other" },
};

export function businessTypeLabel(code: string | undefined): string {
  return (code && businessTypeInfo[code]?.label) ?? "";
}
