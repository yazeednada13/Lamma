import { z } from "zod";

// Generic field formats (client mirrors of the server validators; the server stays authoritative).
// Business policies (e.g. the password rules) live in their feature, not here.

export const emailSchema = z.string().trim().min(1, "الإيميل مطلوب.").max(256, "الإيميل طويل كثير.").email("اكتب إيميل صحيح، مثلًا name@example.com.");

export const personNameSchema = z.string().trim().min(1, "الاسم مطلوب.").max(100, "الاسم لازم يكون 100 حرف أو أقل.");
