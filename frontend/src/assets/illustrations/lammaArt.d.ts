/** Lamma brand illustrations (static SVG strings, brand palette). Generated from the reference; see lammaArt.js. */
export type ProductArt = "clothing" | "perfume" | "gift" | "jewelry" | "beauty" | "other";

export declare const LammaArt: {
  product(template?: ProductArt | string, cls?: string): string;
  packing(template?: ProductArt | string, play?: boolean): string;
  parcel(cls?: string): string;
  delivery(state?: "courier" | "delivered", play?: boolean): string;
  gather(play?: boolean): string;
  route(n?: number, cls?: string): string;
  sticker(name: string): string;
  stickers: readonly string[];
  colors: Readonly<Record<string, string>>;
};
