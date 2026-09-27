"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Img } from "@/components/img";
import { useLockBody } from "@/components/use-lock-body";

type GalleryProps = {
  images: string[];
  name: string;
  badges: { soldOut: boolean; discount: number; isNew: boolean };
};

export function ProductGallery({ images, name, badges }: GalleryProps) {
  const { t, f } = useI18n();
  const [active, setActive] = useState(0);
  const [zoomAt, setZoomAt] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const list = images.length ? images : [""];
  const n = list.length;

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setActive(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
  };

  const goTo = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    const dir = getComputedStyle(el).direction === "rtl" ? -1 : 1;
    el.scrollTo({ left: dir * i * el.clientWidth, behavior: "smooth" });
  };

  const badgeEls = (
    <div className="pointer-events-none absolute start-4 top-4 z-[2] flex flex-col items-start gap-1.5">
      {badges.soldOut ? (
        <span className="eyebrow bg-charcoal px-2.5 py-1.5 text-[10px] text-cream">{t.common.soldOut}</span>
      ) : (
        <>
          {badges.discount > 0 && (
            <span className="bg-signal px-2.5 py-1.5 font-display text-[12px] font-medium text-white" dir="ltr">
              −{badges.discount}%
            </span>
          )}
          {badges.isNew && <span className="eyebrow bg-cream px-2.5 py-1.5 text-[10px] text-charcoal">{t.common.new}</span>}
        </>
      )}
    </div>
  );

  const spanFor = (i: number) => {
    if (n <= 2 || i === 0) return "col-span-2 aspect-[4/5]";
    const restOdd = (n - 1) % 2 === 1;
    if (restOdd && i === n - 1) return "col-span-2 aspect-[4/5]";
    return "aspect-[3/4]";
  };

  return (
    <>
      {/* Mobile / tablet: swipeable */}
      <div className="relative -mx-5 md:-mx-8 lg:hidden">
        {badgeEls}
        <div ref={scroller} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
          {list.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => src && setZoomAt(i)}
              className="card-img relative aspect-[4/5] w-full shrink-0 snap-center"
              aria-label={f(t.product.imageOf, { i: i + 1, n })}
            >
              {src && <Img src={src} alt={i === 0 ? name : ""} fill priority={i === 0} sizes="(min-width:1024px) 1px, 100vw" className="object-cover" />}
            </button>
          ))}
        </div>
        {n > 1 && (
          <>
            <div className="absolute inset-x-5 bottom-4 flex gap-1.5" aria-hidden="true">
              {list.map((_, i) => (
                <span key={i} className={`h-[2px] flex-1 transition-colors duration-300 ${i === active ? "bg-charcoal" : "bg-charcoal/20"}`} />
              ))}
            </div>
            <span className="absolute bottom-7 end-5 bg-cream/90 px-2.5 py-1 font-display text-[11px] tracking-widest" dir="ltr">
              {String(active + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
            </span>
          </>
        )}
      </div>

      {/* Desktop: editorial grid */}
      <div className="relative hidden grid-cols-2 gap-2 lg:grid">
        {list.map((src, i) => (
          <button
            key={src + i}
            type="button"
            onClick={() => src && setZoomAt(i)}
            className={`card-img group relative cursor-zoom-in ${spanFor(i)}`}
            aria-label={`${t.product.zoom} — ${f(t.product.imageOf, { i: i + 1, n })}`}
          >
            {i === 0 && badgeEls}
            {src && (
              <Img
                src={src}
                alt={i === 0 ? name : ""}
                fill
                priority={i === 0}
                sizes={spanFor(i).includes("col-span-2") ? "(min-width:1024px) 56vw, 100vw" : "(min-width:1024px) 28vw, 50vw"}
                className="img-zoom object-cover"
              />
            )}
            <span className="absolute bottom-4 end-4 grid h-10 w-10 place-items-center bg-cream/90 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <ZoomIn className="h-4 w-4" strokeWidth={1.5} />
            </span>
          </button>
        ))}
      </div>

      <Lightbox images={list.filter(Boolean)} name={name} index={zoomAt} onClose={() => setZoomAt(null)} onIndex={(i) => { setZoomAt(i); goTo(i); }} />
    </>
  );
}

function Lightbox({ images, name, index, onClose, onIndex }: { images: string[]; name: string; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  const { t, f, dir } = useI18n();
  const open = index !== null;
  useLockBody(open);
  const n = images.length;

  const step = useCallback(
    (delta: number) => {
      if (index === null) return;
      onIndex((index + delta + n) % n);
    },
    [index, n, onIndex],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(dir === "rtl" ? -1 : 1);
      if (e.key === "ArrowLeft") step(dir === "rtl" ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, step, dir]);

  const touchX = useRef<number | null>(null);

  if (!open || index === null) return null;

  return (
    <div
      className="fixed inset-0 z-[90] bg-charcoal text-cream [animation:fade-in_.3s_ease_both]"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) step((dx < 0 ? 1 : -1) * (dir === "rtl" ? -1 : 1));
        touchX.current = null;
      }}
    >
      <div className="absolute inset-0 md:inset-x-24 md:inset-y-16">
        <Img key={images[index]} src={images[index]} alt={name} fill sizes="100vw" className="object-contain [animation:fade-in_.4s_ease_both]" />
      </div>
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 md:p-6">
        <span className="font-display text-[12px] tracking-widest text-cream/70" dir="ltr">
          {String(index + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
        </span>
        <button type="button" onClick={onClose} className="grid h-12 w-12 place-items-center border border-cream/25 hover:bg-cream hover:text-charcoal" aria-label={t.common.close}>
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>
      {n > 1 && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            className="absolute start-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center border border-cream/25 hover:bg-cream hover:text-charcoal md:start-6"
            aria-label={t.common.previous}
          >
            <ChevronLeft className="flip-rtl h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className="absolute end-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center border border-cream/25 hover:bg-cream hover:text-charcoal md:end-6"
            aria-label={t.common.next}
          >
            <ChevronRight className="flip-rtl h-5 w-5" />
          </button>
        </>
      )}
      <span className="sr-only" aria-live="polite">{f(t.product.imageOf, { i: index + 1, n })}</span>
    </div>
  );
}
