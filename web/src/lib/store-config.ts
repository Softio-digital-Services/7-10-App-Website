/**
 * Storefront settings. Delivery fees, free-delivery threshold and exchange policy
 * live here so they can be changed in one place.
 */

export const store = {
  name: "7.10",
  fullName: "7.10 Brand",
  currency: "USD",
  launchAt: process.env.NEXT_PUBLIC_LAUNCH_AT ?? "2026-10-07T00:00:00+03:00",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://7-10.store",
  whatsapp: (process.env.NEXT_PUBLIC_WHATSAPP ?? "96170000000").replace(/\D/g, ""),
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM ?? "7.10brand",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@7-10.store",
  freeDeliveryOver: 100,
  exchangeDays: 7,
  deliveryDays: "1–3",
  phonePrefix: "+961",
  lowStockAt: 3,
  newForDays: 30,
} as const;

export type Region = {
  id: string;
  en: string;
  ar: string;
  fee: number;
};

export const regions: Region[] = [
  { id: "beirut", en: "Beirut", ar: "بيروت", fee: 3 },
  { id: "mount-lebanon", en: "Mount Lebanon", ar: "جبل لبنان", fee: 4 },
  { id: "north", en: "North", ar: "الشمال", fee: 5 },
  { id: "akkar", en: "Akkar", ar: "عكار", fee: 5 },
  { id: "south", en: "South", ar: "الجنوب", fee: 5 },
  { id: "nabatieh", en: "Nabatieh", ar: "النبطية", fee: 5 },
  { id: "bekaa", en: "Bekaa", ar: "البقاع", fee: 5 },
  { id: "baalbek-hermel", en: "Baalbek-Hermel", ar: "بعلبك الهرمل", fee: 5 },
];

export function deliveryFeeFor(regionId: string | undefined, subtotal: number) {
  const region = regions.find((r) => r.id === regionId);
  if (!region) return 0;
  if (subtotal >= store.freeDeliveryOver) return 0;
  return region.fee;
}

export const sizeOrder = [
  "XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "4XL",
  "26", "27", "28", "29", "30", "31", "32", "33", "34", "36", "38", "40", "42",
  "OS", "ONE SIZE",
];

export function sizeRank(size: string) {
  const i = sizeOrder.indexOf(size.toUpperCase());
  return i === -1 ? 999 : i;
}

export function sortSizes(sizes: string[]) {
  return [...sizes].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b));
}

export function whatsappLink(message?: string) {
  const base = `https://wa.me/${store.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function isBeforeLaunch(now = Date.now()) {
  return now < new Date(store.launchAt).getTime();
}

/** STORE_MODE: "live" (default) always sells, "soon" always shows the teaser, "auto" shows the teaser until launchAt. */
export function isSoonMode(now = Date.now()) {
  const mode = process.env.STORE_MODE ?? "live";
  return mode === "soon" || (mode === "auto" && isBeforeLaunch(now));
}
