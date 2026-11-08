"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Banknote, Check, LoaderCircle, Mail, Minus, Plus, RefreshCcw, Ruler, ShoppingBag, Truck } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { useI18n } from "@/components/i18n-provider";
import { WhatsAppIcon } from "@/components/icons";
import { SizeGuideDialog, chartFor } from "@/components/size-guide";
import { WishlistButton } from "@/components/product/wishlist-button";
import type { StoreProduct } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { store, whatsappLink } from "@/lib/store-config";

/** preferredSize comes from the customer's saved fit ("My fit" on the account page). */
export function ProductInfo({ product, preferredSize }: { product: StoreProduct; preferredSize?: string | null }) {
  const { t, f } = useI18n();
  const { addItem } = useCart();

  const sizeStock = product.sizes.map((size) => {
    const variants = product.variants.filter((v) => v.size === size);
    const variant = variants.find((v) => v.stock > 0) ?? variants[0];
    return { size, variant, stock: variants.reduce((s, v) => s + v.stock, 0) };
  });
  const onlyOne = sizeStock.length === 1 ? sizeStock[0] : null;

  const fitSize = preferredSize ? sizeStock.find((s) => s.size.toUpperCase() === preferredSize.toUpperCase() && s.stock > 0)?.size : undefined;
  const [size, setSize] = useState<string | null>(onlyOne ? onlyOne.size : (fitSize ?? null));
  const [qty, setQty] = useState(1);
  const [needSize, setNeedSize] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [status, setStatus] = useState<"idle" | "added" | "capped">("idle");
  const [guideOpen, setGuideOpen] = useState(false);

  const buyRef = useRef<HTMLDivElement>(null);
  const sizesRef = useRef<HTMLDivElement>(null);

  const selected = sizeStock.find((s) => s.size === size) ?? null;
  const selectedSoldOut = !!selected && selected.stock <= 0;
  const maxQty = Math.max(1, selected?.stock ?? 1);

  const pickSize = (value: string) => {
    const stock = sizeStock.find((s) => s.size === value)?.stock ?? 1;
    setQty((q) => Math.min(q, Math.max(1, stock)));
    setSize(value);
    setNeedSize(false);
    setStatus("idle");
  };

  const add = () => {
    if (!selected) {
      setNeedSize(true);
      setShakeKey((k) => k + 1);
      sizesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (selected.stock <= 0) return;
    const result = addItem(
      {
        variantId: selected.variant.id,
        productId: product.id,
        slug: product.slug,
        productName: product.name,
        size: selected.size,
        color: selected.variant.color,
        price: product.price,
        compareAt: product.compareAt,
        imageUrl: product.images[0] ?? "",
        maxStock: selected.stock,
      },
      qty,
    );
    setStatus(result === "capped" ? "capped" : "added");
    setTimeout(() => setStatus("idle"), 2200);
  };

  const waMessage = () =>
    f(t.product.whatsappMessage, {
      name: product.name,
      size: selected?.size ?? "—",
      url: `${store.siteUrl}/products/${product.slug}`,
    });

  const lowStock = selected && selected.stock > 0 && selected.stock <= store.lowStockAt;
  const chart = chartFor(product.categorySlug);
  const hasChart = product.sizes.some((s) => s !== "OS");

  const addLabel = product.soldOut || selectedSoldOut ? t.common.soldOut : t.common.addToBag;

  return (
    <div>
      <Link href={`/shop?c=${product.categorySlug}`} className="eyebrow text-[10.5px] text-signal hover:text-charcoal">
        {[product.category, product.colorName].filter(Boolean).join(" · ")}
      </Link>

      <div className="mt-2 flex items-start justify-between gap-3">
        <h1 className="display min-w-0 text-[2.4rem] leading-[0.95] md:text-5xl xl:text-[3.4rem]">{product.name}</h1>
        <WishlistButton productId={product.id} />
      </div>

      <div className="mt-4 flex items-baseline gap-3" dir="ltr">
        <span className={`font-display text-[1.9rem] font-bold leading-none ${product.compareAt ? "text-signal-ink" : ""}`}>{formatPrice(product.price)}</span>
        {product.compareAt && (
          <>
            <span className="text-lg text-charcoal/65 line-through">{formatPrice(product.compareAt)}</span>
            <span className="rounded bg-signal px-2 py-0.5 text-[12px] font-bold text-white">−{product.discount}%</span>
          </>
        )}
      </div>

      {product.description && <p className="mt-3 line-clamp-3 max-w-xl text-[15px] leading-relaxed text-charcoal/80">{product.description}</p>}

      {product.colorName && (
        <p className="mt-5 text-[13px]">
          <span className="font-bold">{t.product.colour}:</span> {product.colorName}
        </p>
      )}

      {/* SIZES */}
      {!onlyOne || onlyOne.size !== "OS" ? (
        <div ref={sizesRef} className="mt-5 scroll-mt-32">
          <div className="flex items-center justify-between">
            <p className="text-[13px]">
              <span className="font-bold">{t.product.size}:</span> {selected?.size ?? "—"}
            </p>
            {hasChart && (
              <button type="button" onClick={() => setGuideOpen(true)} className="flex items-center gap-1.5 text-[13px] font-semibold underline underline-offset-4 hover:text-signal">
                <Ruler className="h-4 w-4" strokeWidth={1.5} />
                {t.product.sizeGuide}
              </button>
            )}
          </div>
          <div key={shakeKey} style={{ gridTemplateColumns: `repeat(${Math.min(Math.max(sizeStock.length, 4), 5)}, minmax(0, 1fr))` }} className={`mt-2.5 grid gap-2 ${shakeKey ? "[animation:shake_.45s_ease]" : ""}`} dir="ltr" role="radiogroup" aria-label={t.product.size}>
            {sizeStock.map((s) => {
              const active = size === s.size;
              const out = s.stock <= 0;
              return (
                <button
                  key={s.size}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={out ? `${s.size} — ${t.common.soldOut}` : undefined}
                  onClick={() => pickSize(s.size)}
                  className={`relative h-11 rounded text-[14px] font-medium transition-colors ${
                    active
                      ? out
                        ? "border border-charcoal bg-cream-2 text-charcoal/65"
                        : "bg-charcoal text-white"
                      : out
                        ? "border border-charcoal/10 text-charcoal/30"
                        : needSize
                          ? "border border-signal/60 hover:border-charcoal"
                          : "border border-charcoal/20 hover:border-charcoal"
                  }`}
                >
                  {s.size}
                  {out && <span className="pointer-events-none absolute inset-0 m-auto h-px w-3/4 -rotate-[20deg] bg-current opacity-60" aria-hidden="true" />}
                  {!out && s.stock <= store.lowStockAt && <span className="absolute end-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <p className={`mt-3 min-h-5 text-[13px] ${needSize ? "text-signal-ink" : "text-charcoal/65"}`} aria-live="polite">
            {needSize ? (
              t.product.chooseSizeFirst
            ) : selectedSoldOut ? (
              t.product.notifyTitle
            ) : lowStock ? (
              <span className="flex items-center gap-2 text-signal-ink">
                <span className="dot-signal pulse-signal" />
                {f(t.product.onlyLeft, { n: selected!.stock })}
              </span>
            ) : (
              t.ui.loosefitNote
            )}
          </p>
        </div>
      ) : null}

      {/* BUY */}
      <div ref={buyRef} className="mt-4">
        {product.soldOut || selectedSoldOut ? (
          <NotifyForm productId={product.id} />
        ) : (
          <div className="hidden gap-3 lg:flex">
            <div className="inline-flex h-[3.25rem] shrink-0 items-center rounded border border-charcoal/50" dir="ltr">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} className="grid h-full w-11 place-items-center hover:bg-charcoal/5 disabled:opacity-30" aria-label={t.bag.decrease}>
                <Minus className="h-3.5 w-3.5" />
              </button>
              <output className="w-8 text-center font-display text-[15px] tabular-nums" aria-label={t.product.quantity} aria-live="polite">
                {qty}
              </output>
              <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} className="grid h-full w-11 place-items-center hover:bg-charcoal/5 disabled:opacity-30" aria-label={t.bag.increase}>
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button type="button" onClick={add} className={`btn flex-1 ${status === "added" ? "btn-olive" : "btn-primary"}`}>
              {status === "added" ? (
                <>
                  <Check className="h-4 w-4" /> {t.bag.added}
                </>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" />
                  {addLabel}
                  {selected && <span dir="ltr">· {selected.size}</span>}
                </>
              )}
            </button>
          </div>
        )}
        {status === "capped" && <p className="mt-2 text-[13px] text-signal-ink">{t.bag.maxStock}</p>}

        <a
          href={whatsappLink(waMessage())}
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline mt-3 w-full"
        >
          <WhatsAppIcon className="h-[18px] w-[18px]" />
          {t.ui.askWhatsApp}
        </a>
      </div>

      {/* PROMISES */}
      <ul className="mt-5 grid gap-3.5 rounded-lg bg-stone p-5 text-[13.5px]">
        <li className="flex items-center gap-3">
          <Truck className="h-[18px] w-[18px] shrink-0 text-signal" strokeWidth={1.5} />
          <span>
            <b>{t.checkout.cod}</b> {f(t.ui.deliveryLine, { days: store.deliveryDays })}
          </span>
        </li>
        <li className="flex items-center gap-3">
          <Banknote className="h-[18px] w-[18px] shrink-0 text-signal" strokeWidth={1.5} />
          <span>
            <b>{t.checkout.whish}</b> {t.ui.whishLine}
          </span>
        </li>
        <li className="flex items-center gap-3">
          <RefreshCcw className="h-[18px] w-[18px] shrink-0 text-signal" strokeWidth={1.5} />
          <span>
            <b>{t.ui.easyReturns}</b> {f(t.ui.returnsLine, { days: store.exchangeDays })}
          </span>
        </li>
      </ul>

      {/* DETAILS */}
      <div className="mt-6 divide-y divide-charcoal/15 border-y border-charcoal/15">
        {product.description && (
          <Accordion title={t.product.description} defaultOpen>
            <p>{product.description}</p>
          </Accordion>
        )}
        <Accordion title={t.product.fabric}>
          <p>{t.product.fabricBody}</p>
        </Accordion>
        <Accordion title={t.product.delivery}>
          <p>
            {f(t.product.deliveryBody, {
              days: store.deliveryDays,
              free: formatPrice(store.freeDeliveryOver),
              exchange: store.exchangeDays,
            })}
          </p>
          <Link href="/help#delivery" className="mt-3 inline-block underline underline-offset-4">
            {t.common.help}
          </Link>
        </Accordion>
      </div>


      {hasChart && <SizeGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} initial={chart} highlight={selected?.size} />}

      {/* PHONE BUY BAR: always on, as in the design */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-charcoal/10 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-md lg:hidden">
        {product.soldOut || selectedSoldOut ? (
          <p className="py-2 text-center text-[14px] font-semibold text-charcoal/70">{t.common.soldOut}</p>
        ) : (
          <div className="flex items-center gap-3">
            <div className="inline-flex h-12 shrink-0 items-center rounded border border-charcoal/50" dir="ltr">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} className="grid h-full w-10 place-items-center disabled:opacity-30" aria-label={t.bag.decrease}>
                <Minus className="h-3.5 w-3.5" />
              </button>
              <output className="w-6 text-center text-[15px] font-semibold tabular-nums">{qty}</output>
              <button type="button" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} className="grid h-full w-10 place-items-center disabled:opacity-30" aria-label={t.bag.increase}>
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button type="button" onClick={add} className={`btn min-h-12 flex-1 px-4 ${status === "added" ? "btn-olive" : "btn-primary"}`}>
              {status === "added" ? (
                <Check className="pop h-4 w-4" />
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" />
                  {selected ? (
                    <>
                      {addLabel} <span dir="ltr">· {selected.size}</span>
                    </>
                  ) : (
                    t.product.selectSize
                  )}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Accordion({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="smooth group" open={defaultOpen}>
      <summary className="heading-cond flex cursor-pointer list-none items-center justify-between py-4 text-[16px] [&::-webkit-details-marker]:hidden">
        {title}
        <span className="relative h-4 w-4" aria-hidden="true">
          <Minus className="absolute inset-0 h-4 w-4" strokeWidth={2} />
          <Minus className="absolute inset-0 h-4 w-4 rotate-90 transition-transform duration-300 group-open:rotate-0" strokeWidth={2} />
        </span>
      </summary>
      <div className="pb-5 text-[14px] leading-relaxed text-charcoal/75">{children}</div>
    </details>
  );
}

function NotifyForm({ productId }: { productId: string }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setState("error");
      return;
    }
    setState("loading");
    const res = await fetch("/api/stock-notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, email }),
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  };

  if (state === "done") {
    return (
      <p className="flex items-center gap-3 rounded-md bg-forest px-5 py-4 text-[14px] text-cream">
        <Check className="h-4 w-4 shrink-0" /> {t.product.notifyDone}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg bg-stone p-5">
      <p className="display text-xl">{t.product.notifyTitle}</p>
      <p className="mt-1 text-[14px] text-charcoal/65">{t.product.notifyBody}</p>
      <div className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <Mail className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal/40" />
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (state === "error") setState("idle");
            }}
            placeholder={t.product.notifyPlaceholder}
            aria-label={t.product.notifyPlaceholder}
            aria-invalid={state === "error"}
            className="field ps-11"
            required
          />
        </div>
        <button type="submit" className="btn btn-primary shrink-0" disabled={state === "loading"}>
          {state === "loading" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : t.product.notifyCta}
        </button>
      </div>
      {state === "error" && <p className="mt-2 text-[13px] text-signal-ink">{t.checkout.errEmail}</p>}
    </form>
  );
}
