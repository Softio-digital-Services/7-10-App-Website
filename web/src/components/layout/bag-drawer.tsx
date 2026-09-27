"use client";

import { Img as Image } from "@/components/img";
import Link from "next/link";
import { useEffect } from "react";
import { ArrowRight, Minus, Plus, X } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { useCart } from "@/components/cart-provider";
import { useI18n } from "@/components/i18n-provider";
import { useLockBody } from "@/components/use-lock-body";
import { formatPrice } from "@/lib/format";
import { store } from "@/lib/store-config";

export function BagDrawer() {
  const { t, f } = useI18n();
  const { items, count, subtotal, drawerOpen, closeDrawer, updateQuantity, removeItem, refresh, lastAddedId } = useCart();
  useLockBody(drawerOpen);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDrawer();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  useEffect(() => {
    if (drawerOpen) refresh();
  }, [drawerOpen, refresh]);

  const remaining = Math.max(0, store.freeDeliveryOver - subtotal);
  const progress = Math.min(100, (subtotal / store.freeDeliveryOver) * 100);

  return (
    <div className={`fixed inset-0 z-[70] ${drawerOpen ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!drawerOpen} inert={!drawerOpen}>
      <div
        className={`absolute inset-0 bg-charcoal/50 transition-opacity duration-500 ${drawerOpen ? "opacity-100" : "opacity-0"}`}
        onClick={closeDrawer}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t.bag.title}
        className={`absolute inset-y-0 end-0 flex w-full max-w-[440px] flex-col bg-cream shadow-2xl transition-transform duration-700 ease-[var(--ease-out-expo)] ${
          drawerOpen ? "translate-x-0" : "translate-x-full rtl:-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-charcoal/10 px-5 md:h-[76px] md:px-7">
          <h2 className="flex items-baseline gap-3">
            <span className="display text-2xl">{t.bag.title}</span>
            <span className="font-display text-sm text-charcoal/50" dir="ltr">({count})</span>
          </h2>
          <button type="button" onClick={closeDrawer} className="-me-2 grid h-11 w-11 place-items-center" aria-label={t.common.close}>
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="relative p-6 text-charcoal/25">
              <LogoMark className="h-16 w-auto" tone="silver" />
            </div>
            <p className="display mt-4 text-3xl">{t.bag.empty}</p>
            <p className="mt-2 text-charcoal/60">{t.bag.emptyBody}</p>
            <Link href="/shop" onClick={closeDrawer} className="btn btn-primary mt-8">
              {t.common.shopAll}
              <ArrowRight className="flip-rtl h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            <div className="border-b border-charcoal/10 px-5 py-4 md:px-7">
              <p className="text-[13px]">
                {remaining > 0 ? (
                  f(t.bag.freeProgress, { amount: formatPrice(remaining) })
                ) : (
                  <span className="flex items-center gap-2 font-medium text-olive">
                    <span className="dot-signal" /> {t.bag.freeUnlocked}
                  </span>
                )}
              </p>
              <div className="mt-3 h-[3px] w-full bg-charcoal/10">
                <div
                  className="h-full bg-charcoal transition-[width] duration-700 ease-[var(--ease-out-expo)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <ul className="flex-1 divide-y divide-charcoal/10 overflow-y-auto px-5 md:px-7">
              {items.map((item) => (
                <li
                  key={item.variantId}
                  className={`flex gap-4 py-5 transition-colors duration-1000 ${lastAddedId === item.variantId ? "rise" : ""}`}
                >
                  <Link href={`/products/${item.slug}`} onClick={closeDrawer} className="card-img relative block h-[120px] w-[92px] shrink-0">
                    {item.imageUrl && <Image src={item.imageUrl} alt={item.productName} fill sizes="92px" className="object-cover" />}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/products/${item.slug}`} onClick={closeDrawer} className="text-[15px] font-medium leading-snug hover:underline">
                        {item.productName}
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeItem(item.variantId)}
                        className="-me-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center text-charcoal/50 hover:text-charcoal"
                        aria-label={t.bag.remove}
                      >
                        <X className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>
                    <p className="mt-1 text-[13px] text-charcoal/60">
                      {t.bag.size}: <span dir="ltr">{item.size}</span>
                      {item.color && item.color !== "Default" ? ` · ${item.color}` : ""}
                    </p>
                    <div className="mt-auto flex items-end justify-between pt-3">
                      <QtyStepper
                        value={item.quantity}
                        max={item.maxStock}
                        onChange={(q) => updateQuantity(item.variantId, q)}
                        labels={{ dec: t.bag.decrease, inc: t.bag.increase }}
                      />
                      <div className="text-end" dir="ltr">
                        {item.compareAt && (
                          <p className="text-xs text-charcoal/45 line-through">{formatPrice(item.compareAt * item.quantity)}</p>
                        )}
                        <p className={`text-[15px] font-medium ${item.compareAt ? "text-signal" : ""}`}>
                          {formatPrice(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-charcoal/10 bg-cream-2/60 px-5 pb-6 pt-5 md:px-7">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">{t.bag.subtotal}</span>
                <span className="font-display text-2xl" dir="ltr">{formatPrice(subtotal)}</span>
              </div>
              <p className="mt-1 text-[13px] text-charcoal/55">{t.bag.deliveryAtCheckout}</p>
              <Link href="/checkout" onClick={closeDrawer} className="btn btn-primary mt-5 w-full">
                {t.bag.checkout}
                <ArrowRight className="flip-rtl h-4 w-4" />
              </Link>
              <Link href="/cart" onClick={closeDrawer} className="mt-3 block text-center text-[13px] underline-offset-4 hover:underline">
                {t.bag.viewBag}
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export function QtyStepper({
  value,
  max,
  onChange,
  labels,
  size = "sm",
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  labels: { dec: string; inc: string };
  size?: "sm" | "md";
}) {
  const h = size === "md" ? "h-12" : "h-9";
  const w = size === "md" ? "w-12" : "w-9";
  return (
    <div className={`inline-flex items-center border border-charcoal/20 ${h}`} dir="ltr">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        className={`grid ${h} ${w} place-items-center transition-colors hover:bg-charcoal/5`}
        aria-label={labels.dec}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-8 text-center font-display text-sm tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        className={`grid ${h} ${w} place-items-center transition-colors hover:bg-charcoal/5 disabled:opacity-30`}
        aria-label={labels.inc}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
