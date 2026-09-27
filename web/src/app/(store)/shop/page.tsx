import type { Metadata } from "next";
import { ShopView } from "@/components/shop/shop-view";
import { allSizes, getCategories, getProducts, type SortKey } from "@/lib/catalog";
import { categoryLabel, fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const sortKeys: SortKey[] = ["featured", "new", "price-asc", "price-desc"];

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

function parseFilters(sp: Awaited<SearchParams>) {
  const sort = one(sp.sort) as SortKey | undefined;
  return {
    category: one(sp.c),
    q: one(sp.q),
    sizes: (one(sp.size) ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    inStock: one(sp.stock) === "1",
    sale: one(sp.sale) === "1",
    sort: sort && sortKeys.includes(sort) ? sort : "featured",
  } as const;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { dict: t } = await getI18n();
  const filters = parseFilters(await searchParams);
  let title = t.shop.title;
  if (filters.q) title = fmt(t.shop.searchResults, { q: filters.q });
  else if (filters.category) title = categoryLabel(t, filters.category, filters.category);
  else if (filters.sale) title = t.shop.onSale;
  return { title };
}

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const { locale } = await getI18n();
  const filters = parseFilters(await searchParams);

  const [products, scope, categories] = await Promise.all([
    getProducts({ ...filters, sizes: [...filters.sizes] }, locale),
    getProducts({ category: filters.category, q: filters.q, sale: filters.sale }, locale),
    getCategories(locale),
  ]);

  return (
    <ShopView
      products={products}
      categories={categories}
      sizes={allSizes(scope)}
      scopeTotal={scope.length}
      filters={{ ...filters, sizes: [...filters.sizes] }}
    />
  );
}
