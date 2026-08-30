"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Category = {
  id: string;
  name: string;
  slug: string;
  _count: { products: number };
};

export function StoreFilters({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/?${params.toString()}`);
  }

  return (
    <form
      className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 md:grid-cols-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <input
        defaultValue={searchParams.get("search") ?? ""}
        placeholder="Search products"
        className="rounded-xl border border-stone-300 px-3 py-2"
        onChange={(e) => updateParam("search", e.target.value)}
      />
      <select
        defaultValue={searchParams.get("category") ?? ""}
        className="rounded-xl border border-stone-300 px-3 py-2"
        onChange={(e) => updateParam("category", e.target.value)}
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.slug}>
            {category.name} ({category._count.products})
          </option>
        ))}
      </select>
      <select
        defaultValue={searchParams.get("sort") ?? "newest"}
        className="rounded-xl border border-stone-300 px-3 py-2"
        onChange={(e) => updateParam("sort", e.target.value)}
      >
        <option value="newest">Newest</option>
        <option value="name">Name</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
      </select>
      <label className="flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2 text-sm">
        <input
          type="checkbox"
          defaultChecked={searchParams.get("discount") === "1"}
          onChange={(e) => updateParam("discount", e.target.checked ? "1" : "")}
        />
        On sale only
      </label>
    </form>
  );
}
