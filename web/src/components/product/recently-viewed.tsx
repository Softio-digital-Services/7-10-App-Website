"use client";

import Link from "next/link";
import { useEffect } from "react";
import { SectionLabel } from "@/components/brand/section-label";
import { useI18n } from "@/components/i18n-provider";
import { Img } from "@/components/img";
import type { StoreProduct } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { createLocalStore, useLocalStore } from "@/lib/local-store";

const MAX = 12;

type Recent = { slug: string; name: string; image: string; price: number };

const EMPTY: Recent[] = [];
const recent = createLocalStore<Recent[]>("710.recent.v1", EMPTY, (value) => (Array.isArray(value) ? (value as Recent[]) : null));

export function RecentlyViewed({ current }: { current: StoreProduct }) {
  const { t } = useI18n();
  const items = useLocalStore(recent)
    .filter((r) => r.slug !== current.slug)
    .slice(0, 6);

  const image = current.images[0] ?? "";
  useEffect(() => {
    const entry: Recent = { slug: current.slug, name: current.name, image, price: current.price };
    recent.set((list) => [entry, ...list.filter((r) => r.slug !== entry.slug)].slice(0, MAX));
  }, [current.slug, current.name, image, current.price]);

  if (items.length < 2) return null;

  return (
    <section className="container-x mt-24 md:mt-32">
      <SectionLabel index="02">{t.product.recentlyViewed}</SectionLabel>
      <div className="no-scrollbar -mx-5 mt-8 flex gap-3 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-6 md:gap-4 md:px-0">
        {items.map((r) => (
          <Link key={r.slug} href={`/products/${r.slug}`} className="group w-32 shrink-0 md:w-auto">
            <div className="card-img relative aspect-[3/4]">
              {r.image && <Img src={r.image} alt={r.name} fill sizes="(min-width:768px) 16vw, 128px" className="img-zoom object-cover" />}
            </div>
            <p className="mt-2 truncate text-[13px] font-medium group-hover:underline group-hover:underline-offset-4">{r.name}</p>
            <p className="text-[12.5px] text-charcoal/55" dir="ltr">{formatPrice(r.price)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
