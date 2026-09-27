"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, Lock, ShoppingBag, Trash2 } from "lucide-react";
import { Brackets } from "@/components/brand/brackets";
import { SectionLabel } from "@/components/brand/section-label";
import { useCart } from "@/components/cart-provider";
import { useI18n } from "@/components/i18n-provider";
import { WhatsAppIcon } from "@/components/icons";
import { Img } from "@/components/img";
import { QtyStepper } from "@/components/layout/bag-drawer";
import { ProductRail } from "@/components/product-rail";
import type { StoreProduct } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { store, whatsappLink } from "@/lib/store-config";

export function BagView({ suggestions }: { suggestions: StoreProduct[] }) {
  const { t, f } = useI18n();
  const { items, ready, count, subtotal, updateQuantity, removeItem, refresh } = useCart();

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  const remaining = Math.max(0, store.freeDeliveryOver - subtotal);
  const progress = Math.min(100, (subtotal / store.freeDeliveryOver) * 100);
  const savings = items.reduce((sum, i) => sum + (i.compareAt ? (i.compareAt - i.price) * i.quantity : 0), 0);
  const inBag = new Set(items.map((i) => i.productId));
  const rail = suggestions.filter((p) => !inBag.has(p.id));

  return (
    <>
      <div className="container-x pb-10 pt-8 md:pt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="display text-5xl md:text-7xl">
            {t.bag.title}
            {ready && count > 0 && (
              <sup className="ms-2 align-top font-display text-base font-normal text-charcoal/40 md:text-2xl" dir="ltr">
                ({count})
              </sup>
            )}
          </h1>
          <Link href="/shop" className="link-line eyebrow">
            {t.bag.continue}
          </Link>
        </div>

        {!ready ? (
          <div className="mt-12 grid gap-10 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-5">
                  <div className="skeleton h-40 w-32" />
                  <div className="flex-1 space-y-3">
                    <div className="skeleton h-5 w-1/2" />
                    <div className="skeleton h-4 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
            <div className="skeleton h-72 lg:col-span-4" />
          </div>
        ) : items.length === 0 ? (
          <div className="relative mx-auto mt-12 max-w-2xl border border-charcoal/15 px-6 py-16 text-center md:py-20">
            <Brackets size="sm" inset="-1px" className="text-charcoal/60" />
            <ShoppingBag className="mx-auto h-8 w-8 text-charcoal/40" strokeWidth={1.25} />
            <p className="display mt-6 text-4xl md:text-5xl">{t.bag.empty}</p>
            <p className="mt-3 text-charcoal/65">{t.bag.emptyBody}</p>
            <Link href="/shop" className="btn btn-primary mt-8">
              {t.common.shopAll} <ArrowRight className="flip-rtl h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-12 lg:grid-cols-12 lg:gap-16">
            <ul className="divide-y divide-charcoal/10 border-y border-charcoal/10 lg:col-span-8">
              {items.map((item) => {
                const low = item.maxStock > 0 && item.maxStock <= store.lowStockAt;
                return (
                  <li key={item.variantId} className="flex gap-4 py-6 md:gap-6">
                    <Link href={`/products/${item.slug}`} className="card-img relative block h-36 w-28 shrink-0 md:h-44 md:w-36">
                      {item.imageUrl && <Img src={item.imageUrl} alt={item.productName} fill sizes="144px" className="img-zoom object-cover" />}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <Link href={`/products/${item.slug}`} className="text-[16px] font-medium leading-snug hover:underline hover:underline-offset-4">
                            {item.productName}
                          </Link>
                          <p className="mt-1 text-[13.5px] text-charcoal/60">
                            {t.bag.size}: <span dir="ltr">{item.size}</span>
                            {item.color && item.color !== "Default" && <> · {item.color}</>}
                          </p>
                          <p className="mt-1 text-[13.5px]" dir="ltr">
                            <span className={item.compareAt ? "text-signal" : "text-charcoal/70"}>{formatPrice(item.price)}</span>
                            {item.compareAt && <span className="ms-2 text-charcoal/40 line-through">{formatPrice(item.compareAt)}</span>}
                          </p>
                        </div>
                        <p className="shrink-0 text-[16px] font-medium" dir="ltr">
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                      {low && (
                        <p className="mt-2 flex items-center gap-2 text-[12.5px] text-signal">
                          <span className="dot-signal pulse-signal" />
                          {f(t.product.onlyLeft, { n: item.maxStock })}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-4">
                        <QtyStepper
                          value={item.quantity}
                          max={item.maxStock}
                          onChange={(q) => updateQuantity(item.variantId, q)}
                          labels={{ dec: t.bag.decrease, inc: t.bag.increase }}
                          size="md"
                        />
                        <button
                          type="button"
                          onClick={() => removeItem(item.variantId)}
                          className="flex items-center gap-2 text-[13px] text-charcoal/55 hover:text-signal"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          <span className="hidden sm:inline">{t.bag.remove}</span>
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <aside className="lg:col-span-4">
              <div className="lg:sticky lg:top-[100px]">
                <div className="bg-cream-2 p-6 md:p-8">
                  <p className="text-[13.5px]">
                    {remaining > 0 ? f(t.bag.freeProgress, { amount: formatPrice(remaining) }) : t.bag.freeUnlocked}
                  </p>
                  <div className="mt-3 h-1 bg-charcoal/10">
                    <div className={`h-full transition-all duration-700 ${remaining > 0 ? "bg-charcoal" : "bg-olive"}`} style={{ width: `${progress}%` }} />
                  </div>

                  <dl className="mt-7 space-y-3 text-[14.5px]">
                    <div className="flex justify-between">
                      <dt className="text-charcoal/70">{t.bag.subtotal}</dt>
                      <dd dir="ltr">{formatPrice(subtotal)}</dd>
                    </div>
                    {savings > 0 && (
                      <div className="flex justify-between text-signal">
                        <dt>{t.shop.onSale}</dt>
                        <dd dir="ltr">−{formatPrice(savings)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-charcoal/70">{t.checkout.deliveryFee}</dt>
                      <dd className={remaining > 0 ? "text-charcoal/50" : "font-medium text-olive"}>
                        {remaining > 0 ? t.bag.deliveryAtCheckout : t.common.free}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-5 flex items-end justify-between border-t border-charcoal pt-5">
                    <span className="eyebrow">{t.checkout.total}</span>
                    <span className="font-display text-3xl font-medium" dir="ltr">
                      {formatPrice(subtotal)}
                    </span>
                  </div>
                  <Link href="/checkout" className="btn btn-primary mt-7 w-full min-h-14">
                    <Lock className="h-4 w-4" strokeWidth={1.75} />
                    {t.bag.checkout}
                  </Link>
                  <p className="mt-4 text-center text-[12.5px] text-charcoal/55">{t.footer.payments}</p>
                </div>
                <a
                  href={whatsappLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center justify-center gap-3 border border-charcoal/10 px-4 py-4 text-[13.5px] text-charcoal/70 hover:border-charcoal/30 hover:text-charcoal"
                >
                  <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
                  {t.help.stillNeedBody}
                </a>
              </div>
            </aside>
          </div>
        )}
      </div>

      {rail.length > 0 && (
        <section className="container-x pb-24 pt-14 md:pb-32 md:pt-20">
          <SectionLabel index="01">{t.home.featuredLabel}</SectionLabel>
          <h2 className="display mt-4 text-4xl md:text-6xl">{t.home.featuredTitle}</h2>
          <div className="mt-10">
            <ProductRail products={rail} />
          </div>
        </section>
      )}
    </>
  );
}
