"use client";

import { Img as Image } from "@/components/img";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { useI18n } from "@/components/i18n-provider";
import { formatPrice } from "@/lib/format";
import { store } from "@/lib/store-config";
import type { StoreProduct } from "@/lib/catalog";

type ProductCardProps = {
  product: StoreProduct;
  priority?: boolean;
  sizes?: string;
  index?: number;
};

/** Swatch colours for the colour names the desktop app uses (brand tones first, then the common names). */
const swatchHex: Record<string, string> = {
  olive: "#313B2B", "olive green": "#5A6255", khaki: "#8A8863", linen: "#D5D4C2", sand: "#D5D4C2",
  black: "#1E231A", white: "#F7F6F3", cream: "#F2EFE6", ivory: "#F4F1E8", grey: "#9A9A9A", gray: "#9A9A9A",
  "haze grey": "#B7B7B7", "haze gray": "#B7B7B7", charcoal: "#3A3D38", navy: "#1E3A5F", "navy blue": "#1E3A5F",
  blue: "#2F5D8C", "light blue": "#9DBAD5", red: "#B51515", burgundy: "#6D1A2A", maroon: "#6D1A2A",
  pink: "#D48AA0", "dusty pink": "#C9A0A0", green: "#4F6B3A", "forest green": "#2F4A2C", mint: "#BFD8C5",
  beige: "#E6D3B3", camel: "#B9935A", tan: "#C7A27C", taupe: "#8B7D6B", brown: "#6B4F3A", chocolate: "#4A3326",
  yellow: "#E2C044", mustard: "#C9A227", orange: "#D9783B", purple: "#6A4C82", lilac: "#B9A6CF",
  bronze: "#8C6A3F", caramel: "#A9713B", sage: "#9CA889", "sage olive": "#7D8466", nude: "#D9B8A0",
};
// Longest names first, so "navy blue" wins over "blue" inside a longer name
const swatchKeys = Object.keys(swatchHex).sort((a, b) => b.length - a.length);
/** Exact colour name, else a known colour word inside it ("Nude Beige" -> beige, "Caramel Tan" -> tan). */
export const swatchColor = (name: string) => {
  const key = name.trim().toLowerCase();
  if (swatchHex[key]) return swatchHex[key];
  const words = ` ${key.replace(/[^a-z]+/g, " ")} `;
  const hit = swatchKeys.find((k) => words.includes(` ${k} `));
  return hit ? swatchHex[hit] : "#ADB1AA";
};
/** Light swatches get a thin ring so they stay visible on white. */
const isLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 200;
};

/** Soft panel tints behind product photos, cycled by grid position. */
const tints = ["bg-stone", "bg-sand", "bg-cream-2", "bg-[#d6d8d4]"];

export function ProductCard({ product, priority = false, sizes = "(min-width:1280px) 25vw, (min-width:768px) 33vw, 50vw", index }: ProductCardProps) {
  const { t, f } = useI18n();
  const { addItem } = useCart();

  const [primary, secondary] = product.images;
  const lowStock = !product.soldOut && product.totalStock <= store.lowStockAt;
  const tint = tints[(index ?? 0) % tints.length];

  // One chip per size; a size is available when any of its variants has stock.
  const sizeOptions = useMemo(() => {
    const map = new Map<string, { size: string; variantId: string; stock: number }>();
    for (const v of product.variants) {
      const prev = map.get(v.size);
      if (!prev || (prev.stock <= 0 && v.stock > 0)) map.set(v.size, { size: v.size, variantId: v.id, stock: v.stock });
    }
    return [...map.values()];
  }, [product.variants]);

  const firstInStock = sizeOptions.find((s) => s.stock > 0);
  const [picked, setPicked] = useState<string | null>(null);
  const selected = sizeOptions.find((s) => s.size === picked && s.stock > 0) ?? firstInStock;
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const oneSize = sizeOptions.length === 1;
  // Colours: every colour of this style, or just this product's own colour when it comes in one
  const colours = product.swatches.length > 1
    ? product.swatches
    : product.colorName
      ? [{ color: product.colorName, slug: product.slug }]
      : [];

  const add = () => {
    if (!selected) return;
    const variant = product.variants.find((v) => v.id === selected.variantId);
    if (!variant) return;
    addItem(
      {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        productName: product.name,
        size: variant.size,
        color: variant.color,
        price: product.price,
        compareAt: product.compareAt,
        imageUrl: primary ?? "",
        maxStock: variant.stock,
      },
      qty,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <article className="group relative flex h-full flex-col">
      <div className={`card-img relative aspect-[3/4] ${tint}`}>
        <Link href={`/products/${product.slug}`} className="absolute inset-0 z-[1]" aria-label={product.name}>
          {primary && (
            <Image
              src={primary}
              alt={product.name}
              fill
              sizes={sizes}
              priority={priority}
              className={`img-zoom object-cover transition-opacity duration-700 ${secondary ? "md:group-hover:opacity-0" : ""} ${
                product.soldOut ? "opacity-60 grayscale-[35%]" : ""
              }`}
            />
          )}
          {secondary && (
            <Image
              src={secondary}
              alt=""
              fill
              sizes={sizes}
              className="img-zoom hidden object-cover opacity-0 transition-opacity duration-700 md:block md:group-hover:opacity-100"
            />
          )}
        </Link>

        <div className="pointer-events-none absolute start-3 top-3 z-[2] flex flex-col items-start gap-1.5">
          {product.soldOut ? (
            <span className="rounded bg-charcoal px-2 py-1 text-[11px] font-semibold text-white">{t.common.soldOut}</span>
          ) : (
            <>
              {product.discount > 0 && (
                <span className="rounded bg-signal px-2 py-1 text-[11px] font-bold text-white" dir="ltr">
                  −{product.discount}%
                </span>
              )}
              {product.isNew && <span className="rounded bg-signal px-2 py-1 text-[11px] font-bold text-white">{t.common.new}</span>}
            </>
          )}
        </div>
      </div>

      {colours.length > 0 && (
        <div className="mt-3 flex items-center gap-2" aria-label={t.design.colours}>
          <div className="flex gap-1.5">
            {colours.map((s) => {
              const on = s.slug === product.slug;
              const hex = swatchColor(s.color);
              const ring = on && colours.length > 1 ? "0 0 0 2px #fff, 0 0 0 3px #313B2B" : isLight(hex) ? "inset 0 0 0 1px #9A9A8C" : undefined;
              return (
                <Link
                  key={s.slug}
                  href={`/products/${s.slug}`}
                  aria-label={s.color}
                  title={s.color}
                  aria-current={on ? "true" : undefined}
                  className="rh-press h-4 w-4 rounded-full"
                  style={{ background: hex, boxShadow: ring }}
                />
              );
            })}
          </div>
          <span className="truncate text-[12px] text-charcoal/65">
            {colours.length > 1 ? `${product.colorName ?? ""} · ${colours.length} ${t.design.colours.toLowerCase()}` : product.colorName}
          </span>
        </div>
      )}

      <div className="mt-3 flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-[14px] font-bold leading-snug md:truncate md:text-[15px]">
          <Link href={`/products/${product.slug}`} className="hover:underline hover:underline-offset-4">
            {product.name}
          </Link>
        </h3>
        <div className="hidden shrink-0 text-end md:block" dir="ltr">
          <p className={`text-[15px] font-bold leading-snug ${product.compareAt ? "text-signal" : ""}`}>{formatPrice(product.price)}</p>
          {product.compareAt && <p className="text-[12px] text-charcoal/60 line-through">{formatPrice(product.compareAt)}</p>}
        </div>
      </div>
      <p className="mt-0.5 truncate text-[12.5px] text-charcoal/65 md:text-[13px]">
        {lowStock ? (
          <span className="flex items-center gap-1.5 text-signal">
            <span className="dot-signal pulse-signal" />
            {f(t.product.onlyLeft, { n: product.totalStock })}
          </span>
        ) : (
          product.spec || [product.category, product.colorName].filter(Boolean).join(" · ")
        )}
      </p>

      <p className={`mt-1 text-[15px] font-bold md:hidden ${product.compareAt ? "text-signal" : ""}`} dir="ltr">
        {formatPrice(product.price)}
        {product.compareAt && <span className="ms-2 text-[12px] font-normal text-charcoal/60 line-through">{formatPrice(product.compareAt)}</span>}
      </p>

      {!product.soldOut && sizeOptions.length > 0 && (
        <div className="mt-auto pt-3">
          {/* Phone: size dropdown */}
          <label className="block md:hidden">
            <span className="mb-1 block text-[12px] font-medium">{t.product.size}</span>
            <span className="relative block">
              <select
                value={selected?.size ?? ""}
                onChange={(e) => setPicked(e.target.value)}
                className="h-10 w-full appearance-none rounded border border-charcoal/40 bg-white ps-3 pe-8 text-[14px]"
                dir="ltr"
              >
                {sizeOptions.map((s) => (
                  <option key={s.size} value={s.size} disabled={s.stock <= 0}>
                    {s.size}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal/60" />
            </span>
          </label>
          <div className="hidden md:block">
          {oneSize ? (
            // A single size is a chip like the others, not a full-width bar
            <div className="flex" dir="ltr">
              <span className="inline-grid h-9 min-w-11 place-items-center rounded border border-charcoal bg-charcoal px-3 text-[13px] font-semibold text-white">
                {sizeOptions[0].size}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5" dir="ltr" role="radiogroup" aria-label={t.product.size}>
              {sizeOptions.map((s) => {
                const on = selected?.size === s.size;
                return (
                  <button
                    key={s.size}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={s.stock <= 0}
                    onClick={() => setPicked(s.size)}
                    className={`h-9 min-w-11 rounded border px-3 text-[13px] font-medium transition-colors ${
                      on ? "border-charcoal bg-charcoal text-white" : "border-charcoal/30 bg-white hover:border-charcoal"
                    } disabled:cursor-not-allowed disabled:border-charcoal/10 disabled:text-charcoal/30 disabled:line-through`}
                  >
                    {s.size}
                  </button>
                );
              })}
            </div>
          )}
          </div>

          <div className="mt-2.5 flex flex-col gap-2 md:flex-row">
            <div className="flex h-10 shrink-0 items-center justify-between rounded border border-charcoal/40 md:h-11 md:justify-start" dir="ltr">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="press grid h-full w-10 place-items-center md:w-8"
                aria-label={t.bag.decrease}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-5 text-center text-[14px] font-medium" aria-live="polite">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(selected?.stock ?? 1, q + 1))}
                className="press grid h-full w-10 place-items-center md:w-8"
                aria-label={t.bag.increase}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button type="button" onClick={add} disabled={!selected} className={`btn btn-sm min-h-10 flex-1 px-3 md:min-h-11 ${added ? "btn-dark" : "btn-primary"}`}>
              {added ? <Check className="pop h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
              {added ? t.common.added : t.common.addToBag}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
