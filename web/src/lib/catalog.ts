import type { Prisma } from "@prisma/client";
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
  count: number;
  image: string | null;
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

type ProductRow = Prisma.ProductGetPayload<{ include: { variants: true; categoryRef: true } }>;

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
    featured: row.featured,
    isNew: row.createdAt.getTime() >= newCutoff,
    createdAt: row.createdAt.toISOString(),
    variants,
    sizes: sortSizes([...new Set(variants.map((v) => v.size))]),
    totalStock,
    soldOut: totalStock <= 0,
  };
}

const include = { variants: true, categoryRef: true } as const;

export async function getProducts(filters: ProductFilters, locale: Locale) {
  const where: Prisma.ProductWhereInput = { active: true };
  if (filters.category) {
    where.OR = [{ categoryRef: { slug: filters.category } }, { category: filters.category }];
  }
  if (filters.sale) where.discount = { gt: 0 };

  const rows = await prisma.product.findMany({ where, include, orderBy: { createdAt: "desc" } });
  let products = rows.map((row) => toStoreProduct(row, locale));

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

export async function getProductBySlug(slug: string, locale: Locale) {
  const row = await prisma.product.findFirst({ where: { slug, active: true }, include });
  return row ? toStoreProduct(row, locale) : null;
}

export async function getRelated(product: StoreProduct, locale: Locale, take = 8) {
  const rows = await prisma.product.findMany({
    where: { active: true, id: { not: product.id } },
    include,
    orderBy: { createdAt: "desc" },
  });
  const all = rows.map((row) => toStoreProduct(row, locale));
  const same = all.filter((p) => p.categorySlug === product.categorySlug);
  const rest = all.filter((p) => p.categorySlug !== product.categorySlug);
  return [...same, ...rest].filter((p) => !p.soldOut).slice(0, take);
}

export async function getCategories(locale: Locale): Promise<StoreCategory[]> {
  const dict = dictionaries[locale];
  const rows = await prisma.product.findMany({ where: { active: true }, include });
  const map = new Map<string, StoreCategory>();
  for (const row of rows) {
    const slug = row.categoryRef?.slug ?? slugify(row.category || "general");
    const name = categoryLabel(dict, slug, row.categoryRef?.name ?? row.category);
    const entry = map.get(slug) ?? { slug, name, count: 0, image: null };
    entry.count += 1;
    if (!entry.image || row.featured) entry.image = row.imageUrl;
    map.set(slug, entry);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function allSizes(products: StoreProduct[]) {
  return sortSizes([...new Set(products.flatMap((p) => p.sizes))]);
}
