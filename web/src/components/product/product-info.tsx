"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Banknote, Check, LoaderCircle, Mail, Minus, Plus, RefreshCcw, Ruler, Share2, Truck } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { useI18n } from "@/components/i18n-provider";
import { WhatsAppIcon } from "@/components/icons";
import { Img } from "@/components/img";
import { SizeGuideDialog, chartFor } from "@/components/size-guide";
import type { StoreProduct } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { store, whatsappLink } from "@/lib/store-config";

export function ProductInfo({ product }: { product: StoreProduct }) {
  const { t, f } = useI18n();
  const { addItem } = useCart();

  const sizeStock = product.sizes.map((size) => {
    const variants = product.variants.filter((v) => v.size === size);
    const variant = variants.find((v) => v.stock > 0) ?? variants[0];
    return { size, variant, stock: variants.reduce((s, v) => s + v.stock, 0) };
  });
  const onlyOne = sizeStock.length === 1 ? sizeStock[0] : null;

  const [size, setSize] = useState<string | null>(onlyOne ? onlyOne.size : null);
  const [qty, setQty] = useState(1);
  const [needSize, setNeedSize] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [status, setStatus] = useState<"idle" | "added" | "capped">("idle");
  const [guideOpen, setGuideOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const [barVisible, setBarVisible] = useState(false);

  const buyRef = useRef<HTMLDivElement>(null);
  const sizesRef = useRef<HTMLDivElement>(null);

  const selected = sizeStock.find((s) => s.size === size) ?? null;
  const selectedSoldOut = !!selected && selected.stock <= 0;
  const maxQty = Math.max(1, selected?.stock ?? 1);

  useEffect(() => {
    const el = buyRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setBarVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

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

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch {
      /* user cancelled */
    }
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
      <div className="flex items-center justify-between gap-4">
        <Link href={`/shop?c=${product.categorySlug}`} className="eyebrow text-charcoal/55 hover:text-charcoal">
          {product.category}
        </Link>
        <button type="button" onClick={share} className="flex items-center gap-2 text-[12.5px] text-charcoal/60 hover:text-charcoal">
          {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" strokeWidth={1.5} />}
          {shared ? t.product.copied : t.product.share}
        </button>
      </div>

      <h1 className="display mt-3 text-[2.6rem] leading-[0.95] md:text-5xl xl:text-[3.6rem]">{product.name}</h1>

      <div className="mt-5 flex items-baseline gap-3" dir="ltr">
        <span className={`text-2xl font-medium ${product.compareAt ? "text-signal" : ""}`}>{formatPrice(product.price)}</span>
        {product.compareAt && (
          <>
            <span className="text-lg text-charcoal/40 line-through">{formatPrice(product.compareAt)}</span>
            <span className="bg-signal px-2 py-0.5 font-display text-[12px] text-white">−{product.discount}%</span>
          </>
        )}
      </div>

      {product.description && <p className="mt-6 max-w-xl text-[15.5px] leading-relaxed text-charcoal/75">{product.description}</p>}

      {product.colorName && (
        <p className="mt-7 flex items-center gap-2 text-[14px]">
          <span className="field-label mb-0">{t.product.colour}</span>
          <span>{product.colorName}</span>
        </p>
      )}

      {/* SIZES */}
      {!onlyOne || onlyOne.size !== "OS" ? (
        <div ref={sizesRef} className="mt-7 scroll-mt-32">
          <div className="flex items-center justify-between">
            <p className="field-label mb-0">
              {t.product.size}
              {selected && <span className="ms-2 normal-case tracking-normal text-charcoal">— {selected.size}</span>}
            </p>
            {hasChart && (
              <button type="button" onClick={() => setGuideOpen(true)} className="flex items-center gap-2 text-[13px] underline underline-offset-4 hover:text-olive">
                <Ruler className="h-4 w-4" strokeWidth={1.5} />
                {t.product.sizeGuide}
              </button>
            )}
          </div>
          <div key={shakeKey} className={`mt-3 grid grid-cols-5 gap-2 ${shakeKey ? "[animation:shake_.45s_ease]" : ""}`} dir="ltr" role="radiogroup" aria-label={t.product.size}>
            {sizeStock.map((s) => {
              const active = size === s.size;
              const out = s.stock <= 0;
              return (
                <button
                  key={s.size}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => pickSize(s.size)}
                  className={`relative h-12 font-display text-[14px] tracking-wider transition-colors ${
                    active
                      ? out
                        ? "border border-charcoal bg-cream-2 text-charcoal/50"
                        : "bg-charcoal text-cream"
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
          <p className={`mt-3 min-h-5 text-[13px] ${needSize ? "text-signal" : "text-charcoal/60"}`} aria-live="polite">
            {needSize ? (
              t.product.chooseSizeFirst
            ) : selectedSoldOut ? (
              t.product.notifyTitle
            ) : lowStock ? (
              <span className="flex items-center gap-2 text-signal">
                <span className="dot-signal pulse-signal" />
                {f(t.product.onlyLeft, { n: selected!.stock })}
              </span>
            ) : selected ? (
              <span className="flex items-center gap-2 text-olive">
                <span className="h-2 w-2 rounded-full bg-olive" />
                {t.product.inStock}
              </span>
            ) : null}
          </p>
        </div>
      ) : null}

      {/* BUY */}
      <div ref={buyRef} className="mt-4">
        {product.soldOut || selectedSoldOut ? (
          <NotifyForm productId={product.id} />
        ) : (
          <div className="flex gap-3">
            <div className="inline-flex h-[3.25rem] shrink-0 items-center border border-charcoal/20" dir="ltr">
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} className="grid h-full w-11 place-items-center hover:bg-charcoal/5 disabled:opacity-30" aria-label={t.bag.decrease}>
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center font-display text-[15px] tabular-nums" aria-label={t.product.quantity}>
                {qty}
              </span>
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
                  {addLabel}
                  <span className="opacity-50">—</span>
                  <span dir="ltr">{formatPrice(product.price * qty)}</span>
                </>
              )}
            </button>
          </div>
        )}
        {status === "capped" && <p className="mt-2 text-[13px] text-signal">{t.bag.maxStock}</p>}

        <a
          href={whatsappLink(waMessage())}
          target="_blank"
          rel="noreferrer"
          className="btn btn-outline mt-3 w-full"
        >
          <WhatsAppIcon className="h-[18px] w-[18px]" />
          {t.product.buyWhatsApp}
        </a>
      </div>

      {/* PROMISES */}
      <ul className="mt-8 grid gap-3 border-y border-charcoal/10 py-6 text-[14px]">
        <li className="flex items-center gap-3">
          <Truck className="h-[18px] w-[18px] shrink-0 text-olive" strokeWidth={1.5} />
          {f(t.product.deliveryNote, { days: store.deliveryDays })}
        </li>
        <li className="flex items-center gap-3">
          <Banknote className="h-[18px] w-[18px] shrink-0 text-olive" strokeWidth={1.5} />
          {f(t.product.freeOver, { free: formatPrice(store.freeDeliveryOver) })}
        </li>
        <li className="flex items-center gap-3">
          <RefreshCcw className="h-[18px] w-[18px] shrink-0 text-olive" strokeWidth={1.5} />
          {f(t.product.exchangeNote, { days: store.exchangeDays })}
        </li>
      </ul>

      {/* DETAILS */}
      <div className="divide-y divide-charcoal/10 border-b border-charcoal/10">
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

      <a href={whatsappLink(waMessage())} target="_blank" rel="noreferrer" className="mt-6 flex items-center gap-3 text-[13.5px] text-charcoal/70 hover:text-charcoal">
        <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
        {t.product.whatsappHelp}
      </a>

      {hasChart && <SizeGuideDialog open={guideOpen} onClose={() => setGuideOpen(false)} initial={chart} highlight={selected?.size} />}

      {/* STICKY MOBILE BAR */}
      <div
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-charcoal/10 bg-cream/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-md transition-transform duration-500 ease-[var(--ease-out-expo)] lg:hidden ${
          barVisible ? "translate-y-0" : "translate-y-full"
        }`}
        aria-hidden={!barVisible}
        inert={!barVisible}
      >
        <div className="flex items-center gap-3">
          <div className="card-img relative h-14 w-11 shrink-0">
            {product.images[0] && <Img src={product.images[0]} alt="" fill sizes="44px" className="object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-medium">{product.name}</p>
            <p className="text-[13px] text-charcoal/65" dir="ltr">
              {formatPrice(product.price)}
              {selected && <span className="ms-2 text-charcoal/45">· {selected.size}</span>}
            </p>
          </div>
          <button
            type="button"
            onClick={add}
            disabled={product.soldOut || selectedSoldOut}
            className={`btn btn-sm min-h-12 shrink-0 px-5 ${status === "added" ? "btn-olive" : "btn-primary"} disabled:opacity-50`}
          >
            {status === "added" ? <Check className="h-4 w-4" /> : selected ? addLabel : t.product.selectSize}
          </button>
        </div>
      </div>
    </div>
  );
}

function Accordion({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between py-5 font-display text-[13px] uppercase tracking-[0.2em] [&::-webkit-details-marker]:hidden">
        {title}
        <Plus className="h-4 w-4 transition-transform duration-300 group-open:rotate-45" strokeWidth={1.5} />
      </summary>
      <div className="pb-6 text-[14.5px] leading-relaxed text-charcoal/75">{children}</div>
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
      <p className="flex items-center gap-3 bg-olive px-5 py-4 text-[14px] text-cream">
        <Check className="h-4 w-4 shrink-0" /> {t.product.notifyDone}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="bg-cream-2 p-5">
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
            className="field bg-cream ps-11"
            required
          />
        </div>
        <button type="submit" className="btn btn-primary shrink-0" disabled={state === "loading"}>
          {state === "loading" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : t.product.notifyCta}
        </button>
      </div>
      {state === "error" && <p className="mt-2 text-[13px] text-signal">{t.checkout.errEmail}</p>}
    </form>
  );
}
