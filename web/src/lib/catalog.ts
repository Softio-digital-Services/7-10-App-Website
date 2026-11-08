import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { discountedPrice, slugify } from "@/lib/utils";
import { sizeRank, sortSizes, store } from "@/lib/store-config";
import { categoryLabel, dictionaries, type Locale } from "@/lib/i18n";

export type StoreVariant = {
  id: string;
  size: string;
  color: string;
  stock: number;
};

export type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  compareAt: number | null;
  discount: number;
  images: string[];
  category: string;
  categorySlug: string;
  colorName: string | null;
  /** "Women · quick-dry knit" */
  spec: string;
  styleCode: string;
  /** The same style in every colour, this one included. */
  swatches: { color: string; slug: string }[];
  featured: boolean;
  isNew: boolean;
  createdAt: string;
  variants: StoreVariant[];
  sizes: string[];
  totalStock: number;
  soldOut: boolean;
};

export type StoreCategory = {
  slug: string;
  name: string;
  /** The name in the other language, for bilingual tiles. */
  altName: string | null;
  count: number;
  image: string | null;
  sortOrder: number;
};

export type SortKey = "featured" | "new" | "price-asc" | "price-desc";

export type ProductFilters = {
  category?: string;
  q?: string;
  sizes?: string[];
  inStock?: boolean;
  sale?: boolean;
  sort?: SortKey;
};

/** Active products as plain JSON (the cache stores JSON, so dates travel as ISO strings). */
type ProductRow = Awaited<ReturnType<typeof loadActiveRows>>[number];

/** Every storefront page reads the catalogue; one query, cached and shared by all of them. */
export const CATALOG_TAG = "catalog";

async function loadActiveRows() {
  const rows = await prisma.product.findMany({
    where: { active: true },
    include: { variants: true, categoryRef: { select: { slug: true, name: true, nameAr: true, sortOrder: true, imageUrl: true } } },
    // Purchase cost never leaves the server, not even into the page cache.
    omit: { cost: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

// Stock changes call refreshCatalog(); the 60 s limit only covers changes made outside this app.
const cachedActiveRows = unstable_cache(loadActiveRows, ["catalog-active-v2"], { tags: [CATALOG_TAG], revalidate: 60 });
const activeRows = cache(() => cachedActiveRows());

/** Call after anything that changes products or stock, so the next page view reads fresh data. */
export function refreshCatalog() {
  try {
    revalidateTag(CATALOG_TAG, { expire: 0 });
  } catch (err) {
    // Outside a request (scripts) there is no cache to clear.
    console.warn("[catalog] revalidate skipped", err);
  }
}

function parseImages(primary: string, extra: string) {
  let list: string[] = [];
  try {
    const parsed = JSON.parse(extra || "[]");
    if (Array.isArray(parsed)) list = parsed.filter((x): x is string => typeof x === "string" && !!x);
  } catch {
    list = [];
  }
  return [primary, ...list].filter((src, i, all) => !!src && all.indexOf(src) === i);
}

export function toStoreProduct(row: ProductRow, locale: Locale): StoreProduct {
  const dict = dictionaries[locale];
  const categorySlug = row.categoryRef?.slug ?? slugify(row.category || "general");
  const price = discountedPrice(row.price, row.discount);
  const variants = row.variants
    .map((v) => ({ id: v.id, size: v.size, color: v.color, stock: Math.max(0, v.stock) }))
    .sort((a, b) => sizeRank(a.size) - sizeRank(b.size) || a.size.localeCompare(b.size));
  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
  const newCutoff = Date.now() - store.newForDays * 24 * 60 * 60 * 1000;

  return {
    id: row.id,
    slug: row.slug,
    name: (locale === "ar" && row.nameAr) || row.name,
    description: (locale === "ar" && row.descriptionAr) || row.description,
    price,
    compareAt: row.discount > 0 ? row.price : null,
    discount: Math.round(row.discount),
    images: parseImages(row.imageUrl, row.images),
    category: categoryLabel(dict, categorySlug, row.categoryRef?.name ?? row.category),
    categorySlug,
    colorName: row.colorName ?? (variants[0]?.color && variants[0].color !== "Default" ? variants[0].color : null),
    spec: row.spec,
    styleCode: row.styleCode,
    swatches: [],
    featured: row.featured,
    // Marked "new" in the desktop app; older catalogues without the flag fall back to the date.
    isNew: row.isNewFlag || (!row.styleCode && new Date(row.createdAt).getTime() >= newCutoff),
    createdAt: row.createdAt,
    variants,
    sizes: sortSizes([...new Set(variants.map((v) => v.size))]),
    totalStock,
    soldOut: totalStock <= 0,
  };
}

/** Fills each product's colour swatches from the other products that share its style code. */
function withSwatches(products: StoreProduct[], rows: ProductRow[]) {
  const byStyle = new Map<string, { color: string; slug: string }[]>();
  for (const r of rows) {
    if (!r.styleCode) continue;
    const list = byStyle.get(r.styleCode) ?? [];
    list.push({ color: r.colorName ?? "", slug: r.slug });
    byStyle.set(r.styleCode, list);
  }
  for (const p of products) {
    const list = p.styleCode ? byStyle.get(p.styleCode) : undefined;
    p.swatches = list && list.length > 1 ? list : [];
  }
  return products;
}

export async function getProducts(filters: ProductFilters, locale: Locale) {
  const allRows = await activeRows();
  let rows = allRows;
  if (filters.category) rows = rows.filter((r) => r.categoryRef?.slug === filters.category || r.category === filters.category);
  if (filters.sale) rows = rows.filter((r) => r.discount > 0);

  let products = withSwatches(rows.map((row) => toStoreProduct(row, locale)), allRows);

  if (filters.q) {
    const needle = filters.q.trim().toLowerCase();
    const raw = new Map(rows.map((r) => [r.id, r]));
    products = products.filter((p) => {
      const r = raw.get(p.id)!;
      return [r.name, r.nameAr ?? "", r.category, p.category, r.description, r.colorName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }

  if (filters.sizes?.length) {
    const wanted = new Set(filters.sizes.map((s) => s.toUpperCase()));
    products = products.filter((p) =>
      p.variants.some((v) => wanted.has(v.size.toUpperCase()) && (!filters.inStock || v.stock > 0)),
    );
  }

  if (filters.inStock) products = products.filter((p) => !p.soldOut);

  switch (filters.sort ?? "featured") {
    case "new":
      products.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case "price-asc":
      products.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      products.sort((a, b) => b.price - a.price);
      break;
    default:
      products.sort(
        (a, b) =>
          Number(a.soldOut) - Number(b.soldOut) ||
          Number(b.featured) - Number(a.featured) ||
          b.createdAt.localeCompare(a.createdAt),
      );
  }

  return products;
}

/** React cache(): generateMetadata and the page share one lookup per request. */
export const getProductBySlug = cache(async (slug: string, locale: Locale) => {
  const rows = await activeRows();
  const row = rows.find((r) => r.slug === slug);
  return row ? withSwatches([toStoreProduct(row, locale)], rows)[0] : null;
});

/** Slugs and last-change dates for the sitemap. */
export async function getProductSlugs() {
  return (await activeRows()).map((r) => ({ slug: r.slug, updatedAt: r.updatedAt }));
}

export async function getRelated(product: StoreProduct, locale: Locale, take = 8) {
  const rows = (await activeRows()).filter((r) => r.id !== product.id);
  const all = rows.map((row) => toStoreProduct(row, locale));
  const same = all.filter((p) => p.categorySlug === product.categorySlug);
  const rest = all.filter((p) => p.categorySlug !== product.categorySlug);
  return [...same, ...rest].filter((p) => !p.soldOut).slice(0, take);
}

export async function getCategories(locale: Locale): Promise<StoreCategory[]> {
  const dict = dictionaries[locale];
  try {
    const rows = await activeRows();
    const map = new Map<string, StoreCategory>();
    for (const row of rows) {
      const slug = row.categoryRef?.slug ?? slugify(row.category || "general");
      const en = row.categoryRef?.name ?? row.category;
      const ar = row.categoryRef?.nameAr ?? null;
      const name = locale === "ar" && ar ? ar : categoryLabel(dict, slug, en);
      const altName = locale === "ar" ? en : ar;
      const entry = map.get(slug) ?? { slug, name, altName, count: 0, image: row.categoryRef?.imageUrl ?? null, sortOrder: row.categoryRef?.sortOrder ?? 0 };
      entry.count += 1;
      if (!entry.image || (!row.categoryRef?.imageUrl && row.featured)) entry.image = row.categoryRef?.imageUrl ?? row.imageUrl;
      map.set(slug, entry);
    }
    return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder || b.count - a.count);
  } catch (err) {
    console.error("Failed to load categories from database:", err);
    return [];
  }
}

export function allSizes(products: StoreProduct[]) {
  return sortSizes([...new Set(products.flatMap((p) => p.sizes))]);
}
