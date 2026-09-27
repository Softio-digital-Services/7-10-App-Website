"use client";

import { Img as Image } from "@/components/img";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { useLockBody } from "@/components/use-lock-body";
import { formatPrice } from "@/lib/format";
import type { StoreProduct } from "@/lib/catalog";

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, f, locale } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ key: string; products: StoreProduct[]; total: number } | null>(null);
  useLockBody(open);

  const term = q.trim();
  const searching = term.length >= 2;
  const key = `${locale}:${term}`;
  const loading = searching && found?.key !== key;
  const results = searching && found ? found.products : [];
  const total = searching && found ? found.total : 0;

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 80);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(term)}&limit=6`, { signal: controller.signal });
        const data = await res.json();
        setFound({ key, products: data.products ?? [], total: data.total ?? 0 });
      } catch {
        if (!controller.signal.aborted) setFound({ key, products: [], total: 0 });
      }
    }, 220);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [searching, term, key]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!term) return;
    onClose();
    router.push(`/shop?q=${encodeURIComponent(term)}`);
  };

  return (
    <div className={`fixed inset-0 z-[60] ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open} inert={!open}>
      <div
        className={`absolute inset-0 bg-charcoal/55 backdrop-blur-[2px] transition-opacity duration-500 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.common.search}
        className={`absolute inset-x-0 top-0 max-h-[92dvh] overflow-y-auto bg-cream transition-transform duration-700 ease-[var(--ease-out-expo)] ${
          open ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="container-x py-5 md:py-8">
          <form onSubmit={submit} className="flex items-center gap-3 border-b border-charcoal pb-3 md:gap-5">
            <Search className="h-6 w-6 shrink-0 md:h-8 md:w-8" strokeWidth={1.25} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.common.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent py-2 font-display text-2xl uppercase placeholder:text-charcoal/30 focus:outline-none md:text-5xl"
              aria-label={t.common.search}
              enterKeyHint="search"
            />
            <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center" aria-label={t.common.close}>
              <X className="h-6 w-6" strokeWidth={1.25} />
            </button>
          </form>

          <div className="min-h-40 py-8">
            {term.length < 2 && <p className="text-charcoal/55">{t.common.searchEmpty}</p>}

            {term.length >= 2 && !loading && results.length === 0 && (
              <p className="text-charcoal/55">{f(t.common.searchNoResults, { q: term })}</p>
            )}

            {results.length > 0 && (
              <>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
                  {results.map((p, i) => (
                    <li key={p.id} className="rise" style={{ animationDelay: `${i * 0.04}s` }}>
                      <Link href={`/products/${p.slug}`} onClick={onClose} className="group block">
                        <div className="card-img aspect-[3/4]">
                          {p.images[0] && (
                            <Image src={p.images[0]} alt={p.name} fill sizes="(min-width:1024px) 16vw, 45vw" className="img-zoom object-cover" />
                          )}
                        </div>
                        <p className="mt-3 text-sm font-medium">{p.name}</p>
                        <p className="text-sm text-charcoal/60" dir="ltr">{formatPrice(p.price)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
                {total > results.length && (
                  <button type="button" onClick={submit} className="btn btn-outline mt-10">
                    {t.common.searchSeeAll} ({total})
                    <ArrowRight className="flip-rtl h-4 w-4" />
                  </button>
                )}
              </>
            )}

            {loading && results.length === 0 && (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i} className="skeleton aspect-[3/4]" />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
