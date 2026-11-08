"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, ArrowRight, RefreshCcw, ShoppingBag, Trash2, Truck } from "lucide-react";
import { CheckoutSteps, orderMessage } from "@/components/checkout/checkout-steps";
import { StockNotice } from "@/components/checkout/stock-notice";
import { useCart } from "@/components/cart-provider";
import { useI18n } from "@/components/i18n-provider";
import { WhatsAppIcon } from "@/components/icons";
import { Img } from "@/components/img";
import { QtyStepper } from "@/components/layout/bag-drawer";
import { formatPrice } from "@/lib/format";
import { store, whatsappLink } from "@/lib/store-config";

/** Tints behind cart thumbnails, cycled per row. */
const tints = ["bg-cream-2", "bg-[#d6d8d4]", "bg-stone", "bg-sand"];

export function BagView() {
  const { t, f } = useI18n();
  const { items, ready, count, subtotal, updateQuantity, removeItem, refresh } = useCart();

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  const remaining = Math.max(0, store.freeDeliveryOver - subtotal);
  const savings = items.reduce((sum, i) => sum + (i.compareAt ? (i.compareAt - i.price) * i.quantity : 0), 0);
  const waHref = whatsappLink(orderMessage(t.ui.waCartIntro, items, [`${t.checkout.subtotal}: ${formatPrice(subtotal)}`]));
  const countLabel = f(count === 1 ? t.bag.countOne : t.bag.count, { n: count });

  const promises = (
    <ul className="mt-5 space-y-3 px-1 text-[14px]">
      <li className="flex items-center gap-3">
        <Truck className="h-5 w-5 shrink-0 text-signal" strokeWidth={1.5} />
        {f(t.product.deliveryNote, { days: store.deliveryDays })}
      </li>
      <li className="flex items-center gap-3">
        <RefreshCcw className="h-5 w-5 shrink-0 text-signal" strokeWidth={1.5} />
        {f(t.product.exchangeNote, { days: store.exchangeDays })}
      </li>
    </ul>
  );

  return (
    <div className="container-x pb-32 pt-4 lg:pb-24 lg:pt-6">
      <CheckoutSteps current={1} />

      {!ready ? (
        <div className="mt-10 grid gap-10 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-5">
                <div className="skeleton h-36 w-28 rounded-lg" />
                <div className="flex-1 space-y-3">
                  <div className="skeleton h-5 w-1/2" />
                  <div className="skeleton h-4 w-1/4" />
                </div>
              </div>
            ))}
          </div>
          <div className="skeleton h-72 rounded-lg lg:col-span-4" />
        </div>
      ) : items.length === 0 ? (
        <div className="mx-auto mt-12 max-w-2xl rounded-lg bg-stone px-6 py-16 text-center md:py-20">
          <ShoppingBag className="mx-auto h-9 w-9 text-charcoal/50" strokeWidth={1.25} />
          <p className="display mt-6 text-4xl md:text-5xl">{t.bag.empty}</p>
          <p className="mt-3 text-charcoal/70">{t.bag.emptyBody}</p>
          <Link href="/shop" className="btn btn-primary mt-8">
            {t.common.shopAll} <ArrowRight className="flip-rtl h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-8">
            <div className="flex items-end justify-between gap-4 border-b border-charcoal/15 pb-5">
              <h1 className="display text-[2.8rem] md:text-[4rem]">{t.bag.title}</h1>
              <span className="hidden pb-2 text-[14px] text-charcoal/75 lg:block">{countLabel}</span>
            </div>

            <StockNotice className="mt-6" />

            <ul className="divide-y divide-charcoal/15 border-b border-charcoal/15">
              {items.map((item, idx) => {
                const low = item.maxStock > 0 && item.maxStock <= store.lowStockAt;
                const colour = item.color && item.color !== "Default" ? item.color : null;
                return (
                  <li key={item.variantId} className="flex gap-4 py-5 md:gap-6 md:py-6">
                    <Link
                      href={`/products/${item.slug}`}
                      className={`card-img relative block h-[120px] w-[100px] shrink-0 md:h-[154px] md:w-[128px] ${tints[idx % tints.length]}`}
                    >
                      {item.imageUrl && <Img src={item.imageUrl} alt={item.productName} fill sizes="128px" className="img-zoom object-cover" />}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <Link href={`/products/${item.slug}`} className="text-[16px] font-bold leading-snug hover:underline hover:underline-offset-4 md:text-[17px]">
                            {item.productName}
                          </Link>
                          <p className="mt-1 text-[14px] text-charcoal/75">
                            <span className="lg:hidden">
                              {colour && <>{colour} · </>}
                              <span dir="ltr">{item.size}</span>
                            </span>
                            <span className="hidden lg:inline">
                              {colour && (
                                <>
                                  {t.product.colour}: {colour} ·{" "}
                                </>
                              )}
                              {t.bag.size}: <span dir="ltr">{item.size}</span>
                            </span>
                          </p>
                          <p className="mt-1 hidden text-[14px] text-charcoal/75 lg:block">
                            {low ? (
                              <span className="flex items-center gap-2 text-signal">
                                <span className="dot-signal pulse-signal" />
                                {f(t.product.onlyLeft, { n: item.maxStock })}
                              </span>
                            ) : (
                              t.ui.readyToDeliver
                            )}
                          </p>
                        </div>
                        <div className="shrink-0 text-end" dir="ltr">
                          <p className="font-display text-[19px] font-bold leading-none md:text-[21px]">{formatPrice(item.price * item.quantity)}</p>
                          {item.compareAt && <p className="mt-1 text-[12.5px] text-charcoal/60 line-through">{formatPrice(item.compareAt * item.quantity)}</p>}
                        </div>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-4 pt-4 lg:justify-start lg:gap-6">
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
                          className="press flex items-center gap-2 text-[14px] hover:text-signal"
                          aria-label={t.bag.remove}
                        >
                          <Trash2 className="h-5 w-5 lg:hidden" strokeWidth={1.5} />
                          <span className="hidden underline underline-offset-4 lg:inline">{t.bag.remove}</span>
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <Link href="/shop" className="mt-6 hidden items-center gap-2 text-[14px] font-semibold underline underline-offset-4 hover:text-signal lg:inline-flex">
              <ArrowLeft className="flip-rtl h-4 w-4" />
              {t.bag.continue}
            </Link>
          </div>

          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-[96px]">
              <div className="rounded-lg bg-stone p-5 md:p-6">
                <p className="heading-cond hidden text-[20px] lg:block">{t.ui.orderSummary}</p>
                <dl className="space-y-3 text-[15px] lg:mt-4">
                  <div className="flex justify-between gap-4">
                    <dt className="text-charcoal/80">
                      {t.bag.subtotal} · {countLabel}
                    </dt>
                    <dd className="font-medium" dir="ltr">{formatPrice(subtotal)}</dd>
                  </div>
                  {savings > 0 && (
                    <div className="flex justify-between gap-4 text-signal">
                      <dt>{t.shop.onSale}</dt>
                      <dd dir="ltr">−{formatPrice(savings)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-charcoal/80">{t.checkout.deliveryFee}</dt>
                    <dd className="text-end font-medium">{remaining > 0 ? t.bag.deliveryAtCheckout : t.common.free}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex items-end justify-between border-t border-charcoal/15 pt-4">
                  <span className="text-[16px] font-bold">{t.checkout.total}</span>
                  <span className="font-display text-[2rem] font-bold leading-none" dir="ltr">
                    {formatPrice(subtotal)}
                  </span>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-charcoal/75">{t.ui.nothingCharged}</p>
                {remaining > 0 && <p className="mt-1 text-[13px] text-charcoal/75">{f(t.bag.freeProgress, { amount: formatPrice(remaining) })}</p>}
                <div className="hidden lg:block">
                  <Link href="/checkout" className="btn btn-primary mt-5 min-h-12 w-full">
                    {t.bag.checkout}
                  </Link>
                  <a href={waHref} target="_blank" rel="noreferrer" className="btn btn-outline mt-3 min-h-12 w-full">
                    <WhatsAppIcon className="h-4 w-4" />
                    {t.ui.orderCartWhatsApp}
                  </a>
                </div>
              </div>
              {promises}
            </div>
          </aside>
        </div>
      )}

      {/* Phone checkout bar */}
      {ready && items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-charcoal/10 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-3 backdrop-blur-md lg:hidden">
          <Link href="/checkout" className="btn btn-primary min-h-12 w-full justify-between text-[16px]">
            <span>{t.bag.checkout}</span>
            <span className="font-display text-[19px] font-bold" dir="ltr">
              {formatPrice(subtotal)}
            </span>
          </Link>
          <a href={waHref} target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-center gap-2 py-1.5 text-[14px] font-semibold">
            <WhatsAppIcon className="h-4 w-4" />
            {t.ui.orCartWhatsApp}
          </a>
        </div>
      )}
    </div>
  );
}
