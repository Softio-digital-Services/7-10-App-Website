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

/** Swatch colours for the colour names the desktop app uses. */
const swatchHex: Record<string, string> = { olive: "#313B2B", khaki: "#8A8863", linen: "#D5D4C2", black: "#1E231A", white: "#F7F6F3", sand: "#D5D4C2", grey: "#9A9A9A", gray: "#9A9A9A" };
export const swatchColor = (name: string) => swatchHex[name.trim().toLowerCase()] ?? "#ADB1AA";

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

      {product.swatches.length > 1 && (
        <div className="mt-3 flex gap-1.5" aria-label={t.design.colours}>
          {product.swatches.map((s) => {
            const on = s.slug === product.slug;
            return (
              <Link
                key={s.slug}
                href={`/products/${s.slug}`}
                aria-label={s.color}
                aria-current={on ? "true" : undefined}
                className="rh-press h-4 w-4 rounded-full"
                style={{
                  background: swatchColor(s.color),
                  boxShadow: on ? "0 0 0 2px #fff, 0 0 0 3px #313B2B" : s.color.toLowerCase() === "linen" ? "inset 0 0 0 1px #9A9A8C" : undefined,
                }}
              />
            );
          })}
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
            <p className="grid h-9 place-items-center rounded bg-charcoal text-[13px] font-semibold text-white">{sizeOptions[0].size}</p>
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
                    className={`h-9 min-w-10 flex-1 rounded border px-2 text-[13px] font-medium transition-colors ${
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
