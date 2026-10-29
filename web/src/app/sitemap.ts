import type { MetadataRoute } from "next";
import { getCategories, getProductSlugs } from "@/lib/catalog";
import { localePath } from "@/lib/i18n";
import { store } from "@/lib/store-config";

/** Rebuilt at most hourly; products come from the cached catalogue. */
export const revalidate = 3600;

const entry = (path: string, lastModified?: string | Date): MetadataRoute.Sitemap[number] => ({
  url: `${store.siteUrl}${path}`,
  lastModified,
  alternates: {
    languages: { en: `${store.siteUrl}${path}`, ar: `${store.siteUrl}${localePath(path, "ar")}` },
  },
});

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([getProductSlugs(), getCategories("en")]).catch(() => [[], []] as const);
  return [
    ...["/", "/shop", "/about", "/help", "/contact", "/track", "/privacy", "/terms"].map((p) => entry(p)),
    ...categories.map((c) => entry(`/shop?c=${encodeURIComponent(c.slug)}`)),
    ...products.map((p) => entry(`/products/${p.slug}`, p.updatedAt)),
  ];
}
