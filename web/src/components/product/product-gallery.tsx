"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Img } from "@/components/img";
import { project, rubberband, velocityX } from "@/components/use-drag-dismiss";
import { useDialogFocus } from "@/components/use-dialog-focus";
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
        <span className="rounded bg-charcoal px-2.5 py-1 text-[11px] font-semibold text-white">{t.common.soldOut}</span>
      ) : (
        <>
          {badges.discount > 0 && (
            <span className="rounded bg-signal px-2.5 py-1 text-[12px] font-bold text-white" dir="ltr">
              −{badges.discount}%
            </span>
          )}
          {badges.isNew && <span className="rounded bg-signal px-2.5 py-1 text-[11px] font-bold text-white">{t.common.new}</span>}
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Phone / tablet: full-bleed swipe with dots */}
      <div className="relative -mx-4 md:-mx-8 lg:hidden">
        {badgeEls}
        <div ref={scroller} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
          {list.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => src && setZoomAt(i)}
              className="topo relative aspect-[4/5] w-full shrink-0 snap-center bg-cream-2"
              aria-label={f(t.product.imageOf, { i: i + 1, n })}
            >
              {src && <Img src={src} alt={i === 0 ? name : ""} fill priority={i === 0} sizes="(min-width:1024px) 1px, 100vw" className="object-cover" />}
            </button>
          ))}
        </div>
        {n > 1 && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2" aria-hidden="true">
            {list.map((_, i) => (
              <span
                key={i}
                className={`h-2 rounded-full transition-all duration-500 ease-[var(--ease-out-expo)] ${i === active ? "w-6 bg-charcoal" : "w-2 bg-charcoal/30"}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: thumbnails + main image */}
      <div className="hidden gap-3 lg:flex">
        {n > 1 && (
          <div className="flex w-[72px] shrink-0 flex-col gap-2.5">
            {list.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => setActive(i)}
                onMouseEnter={() => setActive(i)}
                className={`relative aspect-[4/5] overflow-hidden rounded-md bg-cream-2 transition-[box-shadow,opacity] duration-300 ${
                  i === active ? "shadow-[0_0_0_2px_var(--color-charcoal)]" : "opacity-70 hover:opacity-100"
                }`}
                aria-label={f(t.product.imageOf, { i: i + 1, n })}
                aria-current={i === active}
              >
                {src && <Img src={src} alt="" fill sizes="72px" className="object-cover" />}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => list[active] && setZoomAt(active)}
          className="topo group relative aspect-[4/5] flex-1 cursor-zoom-in overflow-hidden rounded-lg bg-cream-2"
          aria-label={`${t.product.zoom} — ${f(t.product.imageOf, { i: active + 1, n })}`}
        >
          {badgeEls}
          {n > 1 && (
            <span className="absolute end-4 top-4 z-[2] rounded-full bg-white px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-charcoal" dir="ltr">
              {String(active + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
            </span>
          )}
          {list.map((src, i) =>
            src ? (
              <Img
                key={src + i}
                src={src}
                alt={i === 0 ? name : ""}
                fill
                priority={i === 0}
                sizes="(min-width:1024px) 50vw, 1px"
                className={`img-zoom object-cover transition-opacity duration-500 ${i === active ? "opacity-100" : "opacity-0"}`}
              />
            ) : null,
          )}
          <span className="absolute bottom-4 end-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <ZoomIn className="h-4 w-4" strokeWidth={1.5} />
          </span>
        </button>
      </div>

      <Lightbox images={list.filter(Boolean)} name={name} index={zoomAt} onClose={() => setZoomAt(null)} onIndex={(i) => { setZoomAt(i); goTo(i); }} />
    </>
  );
}

function Lightbox({ images, name, index, onClose, onIndex }: { images: string[]; name: string; index: number | null; onClose: () => void; onIndex: (i: number) => void }) {
  const { t, f, dir } = useI18n();
  const open = index !== null;
  useLockBody(open);
  const focusRef = useDialogFocus(open);
  const n = images.length;

  // The side the incoming image slides in from: next arrives from the reading-forward edge.
  const [enterFrom, setEnterFrom] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setEnterFrom(0);
  }

  const step = useCallback(
    (delta: number) => {
      if (index === null) return;
      setEnterFrom(delta * (dir === "rtl" ? -1 : 1));
      onIndex((index + delta + n) % n);
    },
    [index, n, onIndex, dir],
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

  const stage = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ id: number; x0: number; y0: number; axis: "x" | "y" | null; dx: number; samples: { x: number; t: number }[] } | null>(null);

  // The photo follows the finger 1:1; momentum, not distance alone, decides whether it changes.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || !e.isPrimary) return;
    swipe.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null, dx: 0, samples: [] };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = swipe.current;
    const el = stage.current;
    if (!s || s.id !== e.pointerId || !el) return;
    const dx = e.clientX - s.x0;
    if (!s.axis) {
      if (Math.hypot(dx, e.clientY - s.y0) < 10) return;
      s.axis = Math.abs(dx) > Math.abs(e.clientY - s.y0) ? "x" : "y";
      if (s.axis === "x") {
        s.x0 = e.clientX;
        e.currentTarget.setPointerCapture(e.pointerId);
        el.style.transition = "none";
      }
      return;
    }
    if (s.axis !== "x") return;
    const w = el.offsetWidth;
    // A single photo has nowhere to go, so it resists instead of sliding freely.
    s.dx = n > 1 ? dx : Math.sign(dx) * rubberband(Math.abs(dx), w);
    s.samples.push({ x: e.clientX, t: e.timeStamp });
    if (s.samples.length > 8) s.samples.shift();
    el.style.transform = `translateX(${s.dx}px)`;
    el.style.opacity = String(1 - Math.min(0.5, Math.abs(s.dx) / w));
  };

  const onPointerEnd = (e: React.PointerEvent) => {
    const s = swipe.current;
    const el = stage.current;
    if (!s || s.id !== e.pointerId || !el) return;
    swipe.current = null;
    if (s.axis !== "x") return;
    const projected = s.dx + (s.samples.length > 1 ? project(velocityX(s.samples)) : 0);
    const commit = n > 1 && e.type !== "pointercancel" && Math.abs(projected) > el.offsetWidth / 2;
    if (commit) {
      el.style.transition = "none";
      el.style.transform = "";
      el.style.opacity = "";
      step((projected < 0 ? 1 : -1) * (dir === "rtl" ? -1 : 1));
    } else {
      el.style.transition = "transform 0.45s var(--ease-out-expo), opacity 0.45s var(--ease-out-expo)";
      el.style.transform = "";
      el.style.opacity = "";
    }
  };

  if (!open || index === null) return null;

  return (
    <div
      ref={focusRef}
      className="fixed inset-0 z-[90] bg-charcoal text-cream [animation:fade-in_.3s_ease_both]"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      style={{ touchAction: "pan-y pinch-zoom" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div ref={stage} className="absolute inset-0 md:inset-x-24 md:inset-y-16">
        <Img
          key={images[index]}
          src={images[index]}
          alt={name}
          fill
          sizes="100vw"
          className="object-contain [animation:lightbox-enter_.45s_var(--ease-out-expo)_both]"
          style={{ "--enter-x": `${enterFrom * 18}%` } as React.CSSProperties}
        />
      </div>
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 md:p-6">
        <span className="font-display text-[12px] tracking-widest text-cream/70" dir="ltr">
          {String(index + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}
        </span>
        <button type="button" onClick={onClose} className="press grid h-12 w-12 place-items-center border rounded border-cream/25 hover:bg-cream hover:text-charcoal" aria-label={t.common.close}>
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>
      {n > 1 && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            className="press absolute start-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center border rounded border-cream/25 hover:bg-cream hover:text-charcoal md:start-6"
            aria-label={t.common.previous}
          >
            <ChevronLeft className="flip-rtl h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            className="press absolute end-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center border rounded border-cream/25 hover:bg-cream hover:text-charcoal md:end-6"
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
