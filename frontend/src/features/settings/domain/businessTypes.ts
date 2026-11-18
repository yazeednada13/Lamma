import type { ProductArt } from "@/assets/illustrations/lammaArt";

// Presentation of the 13 business types (D-009): hint text and illustration from the approved prototype.
// The labels come from the API only (D-103, resolves OQ-091): see useBusinessTypes().

export const businessTypeInfo: Record<string, { hint: string; art: ProductArt }> = {
  clothing: { hint: "مقاسات وألوان", art: "clothing" },
  shoes_bags: { hint: "مقاس الحذاء", art: "other" },
  perfume: { hint: "الحجم بالمل", art: "perfume" },
  beauty: { hint: "درجات وانتهاء", art: "beauty" },
  accessories: { hint: "خامة ووزن", art: "jewelry" },
  gifts: { hint: "بوكسات وإهداء", art: "gift" },
  home_food: { hint: "طلبات مسبقة", art: "other" },
  handmade: { hint: "حسب الطلب وعربون", art: "other" },
  electronics: { hint: "التوافق والكفالة", art: "other" },
  kids: { hint: "العمر والمقاس", art: "clothing" },
  home_decor: { hint: "الأبعاد", art: "other" },
  books: { hint: "المؤلف", art: "other" },
  other: { hint: "حقولك الخاصة", art: "other" },
};
