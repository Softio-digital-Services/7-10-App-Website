import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/product-card";
import { StoreFilters } from "@/components/store-filters";
import { discountedPrice } from "@/lib/utils";

type PageProps = {
  searchParams: Promise<{
    category?: string;
    search?: string;
    discount?: string;
    sort?: string;
  }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;

  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: {
        active: true,
        ...(params.category ? { categoryRef: { slug: params.category } } : {}),
        ...(params.search
          ? {
              OR: [
                { name: { contains: params.search } },
                { description: { contains: params.search } },
              ],
            }
          : {}),
        ...(params.discount === "1" ? { discount: { gt: 0 } } : {}),
      },
      include: { variants: true, categoryRef: true },
      orderBy:
        params.sort === "price-asc"
          ? { price: "asc" }
          : params.sort === "price-desc"
            ? { price: "desc" }
            : params.sort === "name"
              ? { name: "asc" }
              : { createdAt: "desc" },
    }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-10 space-y-3">
        <p className="text-sm uppercase tracking-[0.2em] text-amber-600">7-10 Store</p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-stone-900 md:text-5xl">
          Shop online. Synced with Otargi inventory.
        </h1>
        <p className="max-w-xl text-stone-600">
          Browse clothing, place orders, and keep stock in sync with your Otargi POS system.
        </p>
      </section>

      <Suspense fallback={<div className="h-24 rounded-2xl bg-stone-100" />}>
        <StoreFilters categories={categories} />
      </Suspense>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((product) => {
          const salePrice = discountedPrice(product.price, product.discount);
          return (
            <ProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              slug={product.slug}
              price={salePrice}
              originalPrice={product.discount > 0 ? product.price : undefined}
              discount={product.discount}
              imageUrl={product.imageUrl}
              category={product.categoryRef?.name ?? product.category}
              inStock={product.variants.some((v) => v.stock > 0)}
            />
          );
        })}
      </div>

      {products.length === 0 && (
        <p className="mt-10 text-center text-stone-600">
          No products match your filters.{" "}
          <Link href="/" className="underline">
            Clear filters
          </Link>
        </p>
      )}
    </main>
  );
}
