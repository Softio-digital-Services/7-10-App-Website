"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useOptimistic, useState, useTransition } from "react";
import { ArrowRight, ChevronDown, Columns2, Grid2x2, Search, SlidersHorizontal, X } from "lucide-react";
import { Brackets } from "@/components/brand/brackets";
import { SectionLabel } from "@/components/brand/section-label";
import { useI18n } from "@/components/i18n-provider";
import { Img } from "@/components/img";
import { NewsletterForm } from "@/components/newsletter-form";
import { ProductCard } from "@/components/product-card";
import { FilterDrawer } from "@/components/shop/filter-drawer";
import type { SortKey, StoreCategory, StoreProduct } from "@/lib/catalog";
import { editorial } from "@/lib/editorial";
import { createLocalStore, useLocalStore } from "@/lib/local-store";

export type ShopFilters = {
  category?: string;
  q?: string;
  sizes: string[];
  inStock: boolean;
  sale: boolean;
  sort: SortKey;
};

export function shopHref(f: ShopFilters) {
  const params = new URLSearchParams();
  if (f.category) params.set("c", f.category);
  if (f.q) params.set("q", f.q);
  if (f.sizes.length) params.set("size", f.sizes.join(","));
  if (f.inStock) params.set("stock", "1");
  if (f.sale) params.set("sale", "1");
  if (f.sort && f.sort !== "featured") params.set("sort", f.sort);
  const qs = params.toString();
  return qs ? `/shop?${qs}` : "/shop";
}

const density = createLocalStore<boolean>("710.shop.dense", true, (value) =>
  typeof value === "boolean" ? value : value === 1 ? true : value === 0 ? false : null,
);

type ShopViewProps = {
  products: StoreProduct[];
  categories: StoreCategory[];
  sizes: string[];
  scopeTotal: number;
  filters: ShopFilters;
};

export function ShopView({ products, categories, sizes, scopeTotal, filters }: ShopViewProps) {
  const { t, f } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useOptimistic(filters, (_, next: ShopFilters) => next);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dense = useLocalStore(density);
  const [query, setQuery] = useState(filters.q ?? "");
  const [syncedQ, setSyncedQ] = useState(filters.q);
  if (filters.q !== syncedQ) {
    setSyncedQ(filters.q);
    setQuery(filters.q ?? "");
  }

  const toggleDensity = (value: boolean) => density.set(value);

  const apply = (patch: Partial<ShopFilters>) => {
    const next = { ...view, ...patch };
    startTransition(() => {
      setView(next);
      router.push(shopHref(next), { scroll: false });
    });
  };

  const clearAll = () => apply({ sizes: [], inStock: false, sale: false });

  const activeCategory = categories.find((c) => c.slug === view.category);
  const allCount = categories.reduce((sum, c) => sum + c.count, 0);
  const refinements = view.sizes.length + Number(view.inStock) + Number(view.sale);

  const title = view.q
    ? f(t.shop.searchResults, { q: view.q })
    : activeCategory
      ? activeCategory.name
      : view.sale
        ? t.shop.onSale
        : view.sort === "new"
          ? t.common.newIn
          : t.shop.title;

  const showEditorial = !view.q && !view.category && refinements === 0 && products.length >= 8;
  const editorialAt = dense ? 6 : 4;

  const sortOptions: { value: SortKey; label: string }[] = [
    { value: "featured", label: t.shop.sortFeatured },
    { value: "new", label: t.shop.sortNew },
    { value: "price-asc", label: t.shop.sortPriceAsc },
    { value: "price-desc", label: t.shop.sortPriceDesc },
  ];

  const catalogEmpty = allCount === 0;

  return (
    <>
      {/* HEADER */}
      <section className="container-x pt-8 md:pt-12">
        <nav className="flex items-center gap-2 text-[12.5px] text-charcoal/50" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-charcoal">{t.common.home}</Link>
          <span aria-hidden="true">/</span>
          <Link href="/shop" className="hover:text-charcoal">{t.common.shop}</Link>
          {activeCategory && (
            <>
              <span aria-hidden="true">/</span>
              <span className="text-charcoal">{activeCategory.name}</span>
            </>
          )}
        </nav>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <div>
            <SectionLabel index={activeCategory ? String(categories.indexOf(activeCategory) + 1).padStart(2, "0") : "00"}>
              {t.shop.collection}
            </SectionLabel>
            <h1 className="display mt-4 text-[3.2rem] leading-[0.92] sm:text-7xl md:text-8xl">
              {title}
              <sup className="ms-2 align-top font-display text-base font-normal text-charcoal/40 md:ms-3 md:text-2xl" dir="ltr">
                ({products.length})
              </sup>
            </h1>
          </div>

          {view.q !== undefined && (
            <form
              className="relative w-full max-w-sm"
              onSubmit={(e) => {
                e.preventDefault();
                apply({ q: query.trim() || undefined });
              }}
            >
              <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.common.searchPlaceholder}
                aria-label={t.common.search}
                className="field ps-11"
                type="search"
              />
            </form>
          )}
        </div>

        {!catalogEmpty && (
          <div className="no-scrollbar -mx-5 mt-8 flex gap-2 overflow-x-auto px-5 md:mx-0 md:mt-10 md:flex-wrap md:px-0">
            <CategoryChip active={!view.category} onClick={() => apply({ category: undefined })} label={t.shop.all} count={allCount} />
            {categories.map((c) => (
              <CategoryChip key={c.slug} active={view.category === c.slug} onClick={() => apply({ category: c.slug })} label={c.name} count={c.count} />
            ))}
          </div>
        )}
      </section>

      {/* TOOLBAR */}
      {!catalogEmpty && (
        <div className="sticky top-16 z-30 mt-8 border-y border-charcoal/10 bg-cream/95 backdrop-blur-md md:top-[76px] md:mt-10">
          <div className="container-x flex h-14 items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex h-10 items-center gap-2.5 border border-charcoal/20 px-4 font-display text-[12px] uppercase tracking-[0.18em] transition-colors hover:border-charcoal"
            >
              <SlidersHorizontal className="h-4 w-4" strokeWidth={1.5} />
              {t.shop.filter}
              {refinements > 0 && (
                <span className="grid h-5 min-w-5 place-items-center bg-charcoal px-1 text-[10px] text-cream">{refinements}</span>
              )}
            </button>

            <div className="no-scrollbar hidden min-w-0 flex-1 items-center gap-2 overflow-x-auto md:flex">
              {view.sizes.map((s) => (
                <ActivePill key={s} label={`${t.shop.size}: ${s}`} onRemove={() => apply({ sizes: view.sizes.filter((x) => x !== s) })} removeLabel={f(t.shop.remove, { name: s })} />
              ))}
              {view.inStock && <ActivePill label={t.shop.inStockOnly} onRemove={() => apply({ inStock: false })} removeLabel={f(t.shop.remove, { name: t.shop.inStockOnly })} />}
              {view.sale && <ActivePill label={t.shop.onSale} onRemove={() => apply({ sale: false })} removeLabel={f(t.shop.remove, { name: t.shop.onSale })} />}
              {refinements > 1 && (
                <button type="button" onClick={clearAll} className="shrink-0 px-2 text-[12.5px] text-charcoal/60 underline underline-offset-4 hover:text-charcoal">
                  {t.shop.clear}
                </button>
              )}
            </div>

            <div className="ms-auto flex items-center gap-1 md:gap-3">
              <label className="relative flex items-center">
                <span className="sr-only">{t.shop.sort}</span>
                <select
                  value={view.sort}
                  onChange={(e) => apply({ sort: e.target.value as SortKey })}
                  className="h-10 cursor-pointer appearance-none bg-transparent pe-7 ps-2 text-[13.5px] font-medium focus:outline-none"
                >
                  {sortOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute end-1 h-4 w-4 text-charcoal/60" />
              </label>

              <div className="hidden h-6 w-px bg-charcoal/15 xs:block" />

              <div className="hidden items-center xs:flex" role="group" aria-label={t.shop.grid}>
                <button
                  type="button"
                  onClick={() => toggleDensity(false)}
                  aria-pressed={!dense}
                  aria-label={t.shop.large}
                  className={`grid h-10 w-10 place-items-center transition-colors ${!dense ? "text-charcoal" : "text-charcoal/35 hover:text-charcoal"}`}
                >
                  <Columns2 className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleDensity(true)}
                  aria-pressed={dense}
                  aria-label={t.shop.compact}
                  className={`grid h-10 w-10 place-items-center transition-colors ${dense ? "text-charcoal" : "text-charcoal/35 hover:text-charcoal"}`}
                >
                  <Grid2x2 className="h-[18px] w-[18px]" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>
          <div className={`absolute inset-x-0 -bottom-px h-[2px] overflow-hidden transition-opacity ${pending ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
            <div className="progress-indeterminate h-full w-1/3 bg-signal" />
          </div>
        </div>
      )}

      {/* GRID */}
      <section className="container-x pb-24 pt-8 md:pb-32 md:pt-10" aria-busy={pending}>
        {catalogEmpty ? (
          <div className="relative mt-4 border border-charcoal/15 px-6 py-16 text-center md:py-24">
            <Brackets size="sm" inset="-1px" className="text-charcoal/60" />
            <p className="display text-4xl md:text-5xl">{t.shop.comingSoonTitle}</p>
            <p className="mx-auto mt-4 max-w-md text-charcoal/65">{t.shop.comingSoonBody}</p>
            <div className="mx-auto mt-8 max-w-md">
              <NewsletterForm tone="dark" />
            </div>
          </div>
        ) : products.length === 0 ? (
          <div className="relative mx-auto max-w-2xl border border-charcoal/15 px-6 py-16 text-center md:py-20">
            <Brackets size="sm" inset="-1px" className="text-charcoal/60" />
            <p className="display text-3xl md:text-5xl">{view.q ? f(t.common.searchNoResults, { q: view.q }) : t.shop.empty}</p>
            {refinements > 0 && (
              <button type="button" onClick={clearAll} className="btn btn-primary mt-8">
                {t.shop.emptyCta}
              </button>
            )}
            <p className="eyebrow mt-10 text-charcoal/50">{t.shop.tryCategories}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {categories.map((c) => (
                <Link key={c.slug} href={`/shop?c=${c.slug}`} className="border border-charcoal/20 px-4 py-2 text-[13.5px] transition-colors hover:border-charcoal hover:bg-charcoal hover:text-cream">
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div
            className={`grid gap-x-3 gap-y-10 transition-opacity duration-300 md:gap-x-5 md:gap-y-14 ${
              dense ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            } ${pending ? "opacity-40" : "opacity-100"}`}
          >
            {products.map((p, i) => (
              <Fragment key={p.id}>
                {showEditorial && i === editorialAt && <EditorialTile />}
                <div className="rise" style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
                  <ProductCard
                    product={p}
                    index={i}
                    priority={i < 4}
                    sizes={dense ? "(min-width:1024px) 24vw, 50vw" : "(min-width:1024px) 32vw, (min-width:640px) 50vw, 100vw"}
                  />
                </div>
              </Fragment>
            ))}
          </div>
        )}

        {products.length > 0 && scopeTotal > products.length && (
          <div className="mt-16 flex justify-center">
            <button type="button" onClick={clearAll} className="btn btn-outline">
              {t.shop.clear} — {f(t.shop.count, { n: scopeTotal })}
            </button>
          </div>
        )}
      </section>

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sizes={sizes}
        filters={view}
        total={products.length}
        pending={pending}
        sortOptions={sortOptions}
        onChange={apply}
        onClear={clearAll}
      />
    </>
  );
}

function CategoryChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-11 shrink-0 items-center gap-2.5 border px-5 text-[14px] transition-colors ${
        active ? "border-charcoal bg-charcoal text-cream" : "border-charcoal/20 hover:border-charcoal"
      }`}
    >
      {label}
      <span className={`font-display text-[11px] ${active ? "text-cream/60" : "text-charcoal/40"}`} dir="ltr">
        {String(count).padStart(2, "0")}
      </span>
    </button>
  );
}

function ActivePill({ label, onRemove, removeLabel }: { label: string; onRemove: () => void; removeLabel: string }) {
  return (
    <span className="flex h-8 shrink-0 items-center gap-1 bg-cream-2 ps-3 text-[12.5px]">
      {label}
      <button type="button" onClick={onRemove} aria-label={removeLabel} className="grid h-8 w-8 place-items-center text-charcoal/60 hover:text-charcoal">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function EditorialTile() {
  const { t } = useI18n();
  return (
    <Link
      href="/about"
      className="group relative col-span-full block aspect-[4/3] overflow-hidden bg-olive text-cream sm:aspect-[16/9] lg:col-span-2 lg:aspect-auto lg:min-h-full"
    >
      <Img src={editorial.lookbook} alt="" fill sizes="(min-width:1024px) 50vw, 100vw" className="img-zoom object-cover opacity-75" />
      <span className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/20 to-transparent" />
      <span className="absolute inset-4 text-cream/70 md:inset-6">
        <Brackets size="sm" inset="0" />
      </span>
      <span className="absolute inset-x-8 bottom-8 md:inset-x-12 md:bottom-12">
        <span className="eyebrow flex items-center gap-3 text-cream/75">
          <span className="dot-signal pulse-signal" /> {t.shop.editorialLabel}
        </span>
        <span className="display mt-4 block max-w-md text-4xl md:text-5xl">{t.shop.editorialTitle}</span>
        <span className="eyebrow mt-6 inline-flex items-center gap-2 border-b border-cream/50 pb-1 transition-colors group-hover:border-cream">
          {t.shop.editorialCta} <ArrowRight className="flip-rtl h-3.5 w-3.5" />
        </span>
      </span>
    </Link>
  );
}
