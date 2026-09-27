"use client";

import { Img as Image } from "@/components/img";
import Link from "next/link";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { useI18n } from "@/components/i18n-provider";
import { formatPrice } from "@/lib/format";
import { store } from "@/lib/store-config";
import type { StoreProduct, StoreVariant } from "@/lib/catalog";

type ProductCardProps = {
  product: StoreProduct;
  priority?: boolean;
  sizes?: string;
  index?: number;
};

export function ProductCard({ product, priority = false, sizes = "(min-width:1280px) 25vw, (min-width:768px) 33vw, 50vw", index }: ProductCardProps) {
  const { t, f } = useI18n();
  const { addItem } = useCart();
  const [quickOpen, setQuickOpen] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const [primary, secondary] = product.images;
  const lowStock = !product.soldOut && product.totalStock <= store.lowStockAt;

  const add = (variant: StoreVariant) => {
    addItem({
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
    });
    setJustAdded(variant.id);
    setTimeout(() => {
      setJustAdded(null);
      setQuickOpen(false);
    }, 900);
  };

  return (
    <article className="group relative">
      <div className="card-img relative aspect-[3/4]">
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
            <span className="bg-charcoal px-2 py-1 eyebrow text-[10px] text-cream">{t.common.soldOut}</span>
          ) : (
            <>
              {product.discount > 0 && (
                <span className="bg-signal px-2 py-1 font-display text-[11px] font-medium text-white keep-tracking tracking-wider" dir="ltr">
                  −{product.discount}%
                </span>
              )}
              {product.isNew && <span className="bg-cream px-2 py-1 eyebrow text-[10px] text-charcoal">{t.common.new}</span>}
            </>
          )}
        </div>

        {typeof index === "number" && (
          <span className="pointer-events-none absolute end-3 top-3 z-[2] font-display text-[11px] text-charcoal/40 mix-blend-multiply" dir="ltr">
            {String(index + 1).padStart(3, "0")}
          </span>
        )}

        {!product.soldOut && (
          <>
            <button
              type="button"
              onClick={() => setQuickOpen((v) => !v)}
              className={`absolute bottom-3 end-3 z-[3] grid h-10 w-10 place-items-center bg-cream/95 text-charcoal shadow-sm transition-transform duration-300 md:hidden ${
                quickOpen ? "rotate-45" : ""
              }`}
              aria-label={t.common.quickAdd}
              aria-expanded={quickOpen}
            >
              <Plus className="h-4 w-4" />
            </button>

            <div
              className={`absolute inset-x-2 bottom-2 z-[2] bg-cream/95 p-3 backdrop-blur-md transition-all duration-500 ease-[var(--ease-out-expo)] md:inset-x-3 md:bottom-3 ${
                quickOpen
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-3 opacity-0 md:group-hover:pointer-events-auto md:group-hover:translate-y-0 md:group-hover:opacity-100"
              } ${quickOpen ? "pe-14 md:pe-3" : ""}`}
            >
              <p className="mb-2 eyebrow text-[10px] text-charcoal/60">{t.common.quickAdd}</p>
              <div className="flex flex-wrap gap-1.5" dir="ltr">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    disabled={v.stock <= 0}
                    onClick={() => add(v)}
                    className={`relative h-9 min-w-9 px-2 font-display text-[12px] transition-colors ${
                      justAdded === v.id
                        ? "bg-olive text-cream"
                        : "border border-charcoal/20 hover:border-charcoal hover:bg-charcoal hover:text-cream"
                    } disabled:cursor-not-allowed disabled:border-charcoal/10 disabled:text-charcoal/30 disabled:line-through disabled:hover:bg-transparent`}
                    aria-label={`${t.common.addToBag} — ${v.size}`}
                  >
                    {justAdded === v.id ? <Check className="mx-auto h-4 w-4" /> : v.size}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-3.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[14.5px] font-medium leading-snug md:text-[15px]">
            <Link href={`/products/${product.slug}`} className="hover:underline hover:underline-offset-4">
              {product.name}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-[13px] text-charcoal/55">
            {lowStock ? (
              <span className="flex items-center gap-1.5 text-signal">
                <span className="dot-signal pulse-signal" />
                {f(t.product.onlyLeft, { n: product.totalStock })}
              </span>
            ) : (
              [product.category, product.colorName].filter(Boolean).join(" · ")
            )}
          </p>
        </div>
        <div className="shrink-0 text-end" dir="ltr">
          <p className={`text-[14.5px] font-medium md:text-[15px] ${product.compareAt ? "text-signal" : ""}`}>{formatPrice(product.price)}</p>
          {product.compareAt && <p className="text-[12px] text-charcoal/45 line-through">{formatPrice(product.compareAt)}</p>}
        </div>
      </div>
    </article>
  );
}
