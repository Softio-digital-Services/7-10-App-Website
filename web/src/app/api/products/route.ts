import { NextResponse } from "next/server";
import { getProducts, type SortKey } from "@/lib/catalog";
import { getLocale } from "@/lib/i18n/server";

const sorts: SortKey[] = ["featured", "new", "price-asc", "price-desc"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locale = await getLocale();
  const sortParam = searchParams.get("sort") as SortKey | null;
  const limit = Math.min(Number(searchParams.get("limit") ?? 48) || 48, 100);

  const products = await getProducts(
    {
      q: searchParams.get("q") ?? searchParams.get("search") ?? undefined,
      category: searchParams.get("c") ?? searchParams.get("category") ?? undefined,
      sale: searchParams.get("sale") === "1",
      sort: sortParam && sorts.includes(sortParam) ? sortParam : "featured",
    },
    locale,
  );

  return NextResponse.json({ total: products.length, products: products.slice(0, limit) });
}
