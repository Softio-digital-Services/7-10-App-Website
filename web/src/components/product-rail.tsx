"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { useI18n } from "@/components/i18n-provider";
import type { StoreProduct } from "@/lib/catalog";

export function ProductRail({ products }: { products: StoreProduct[] }) {
  const { t, dir } = useI18n();
  const scroller = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [visible, setVisible] = useState(0.3);

  const update = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft);
    setVisible(el.clientWidth / Math.max(el.scrollWidth, 1));
    setProgress(max > 0 ? pos / max : 1);
    setAtStart(pos < 4);
    setAtEnd(pos > max - 4);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  const step = (direction: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8 * direction * (dir === "rtl" ? -1 : 1);
    el.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <div>
      <div
        ref={scroller}
        onScroll={update}
        className="no-scrollbar -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 md:-mx-8 md:scroll-px-8 md:gap-5 md:px-8 xl:-mx-12 xl:scroll-px-12 xl:px-12"
      >
        {products.map((product, i) => (
          <div key={product.id} className="w-[68%] shrink-0 snap-start xs:w-[46%] md:w-[31%] lg:w-[23.5%] 2xl:w-[19%]">
            <ProductCard product={product} sizes="(min-width:1024px) 24vw, (min-width:768px) 32vw, 68vw" index={i} />
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center gap-6">
        <div className="relative h-px flex-1 bg-charcoal/15">
          <div
            className="absolute inset-y-0 start-0 bg-charcoal transition-[width] duration-300"
            style={{ width: `${Math.max(visible, progress) * 100}%` }}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={atStart}
            className="grid h-11 w-11 place-items-center border border-charcoal/25 transition-colors hover:bg-charcoal hover:text-cream disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-charcoal"
            aria-label={t.common.previous}
          >
            <ArrowLeft className="flip-rtl h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={atEnd}
            className="grid h-11 w-11 place-items-center border border-charcoal/25 transition-colors hover:bg-charcoal hover:text-cream disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-charcoal"
            aria-label={t.common.next}
          >
            <ArrowRight className="flip-rtl h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
