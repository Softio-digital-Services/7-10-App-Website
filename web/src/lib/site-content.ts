import { cache } from "react";
import { unstable_cache } from "next/cache";
import { CATALOG_TAG } from "@/lib/catalog";
import { isMediaName } from "@/lib/hub/media";
import type { Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

/**
 * Website content managed in the 7.10 desktop app (Website screen) and synced here:
 * store facts, placed images, the gallery and customer reviews. Read from the hub's synced rows.
 */

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v)).trim();
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export type SiteImage = { slot: string; src: string | null; captionEn: string; captionAr: string; span: string; order: number };
export type SiteReview = {
  id: string;
  quote: string;
  lang: "en" | "ar";
  product: string;
  customer: string;
  city: string;
  rating: number;
  placeholder: boolean;
};

/** Synced image paths arrive as "Assets/Products/<hash>.<ext>" once the laptop uploaded the file. */
function mediaUrl(path: string) {
  const file = path.replace(/\\/g, "/").split("/").pop()?.toLowerCase() ?? "";
  return isMediaName(file) ? `/media/${file}` : null;
}

async function load() {
  const rows = await prisma.syncRow.findMany({
    where: { tbl: { in: ["site_settings", "site_media", "site_reviews"] }, deleted: false },
    select: { tbl: true, gid: true, data: true },
  });
  const facts: Record<string, { en: string; ar: string }> = {};
  const images: SiteImage[] = [];
  const reviews: (SiteReview & { order: number })[] = [];
  for (const r of rows) {
    let d: Row;
    try {
      d = JSON.parse(r.data) as Row;
    } catch {
      continue;
    }
    if (r.tbl === "site_settings") {
      const key = str(d.setting_key);
      if (key) facts[key] = { en: str(d.value_en), ar: str(d.value_ar) || str(d.value_en) };
    } else if (r.tbl === "site_media") {
      if (num(d.is_active ?? 1) === 0) continue;
      images.push({
        slot: str(d.slot),
        src: mediaUrl(str(d.image_path)),
        captionEn: str(d.caption_en),
        captionAr: str(d.caption_ar),
        span: str(d.span) || "normal",
        order: num(d.sort_order),
      });
    } else if (r.tbl === "site_reviews") {
      if (num(d.is_approved ?? 1) === 0 || !str(d.quote)) continue;
      reviews.push({
        id: r.gid,
        quote: str(d.quote),
        lang: str(d.lang) === "ar" ? "ar" : "en",
        product: str(d.product_name),
        customer: str(d.customer_name),
        city: str(d.city),
        rating: Math.min(5, Math.max(1, num(d.rating) || 5)),
        placeholder: num(d.is_placeholder) === 1,
        order: num(d.sort_order),
      });
    }
  }
  images.sort((a, b) => a.order - b.order);
  reviews.sort((a, b) => a.order - b.order);
  return { facts, images, reviews };
}

const cached = unstable_cache(load, ["site-content-v1"], { tags: [CATALOG_TAG], revalidate: 60 });
const getContent = cache(() =>
  cached().catch(() => ({
    facts: {} as Record<string, { en: string; ar: string }>,
    images: [] as SiteImage[],
    reviews: [] as (SiteReview & { order: number })[],
  })),
);

/** A store fact in the visitor's language, or the design's [bracketed] placeholder when the app has none. */
export async function siteFacts(locale: Locale) {
  const { facts } = await getContent();
  return (key: string, placeholder: string) => {
    const f = facts[key];
    const v = f ? (locale === "ar" ? f.ar : f.en) : "";
    return v || placeholder;
  };
}

export async function siteImage(slot: string) {
  const { images } = await getContent();
  return images.find((i) => i.slot === slot) ?? null;
}

export async function siteGallery() {
  const { images } = await getContent();
  return images.filter((i) => i.slot === "gallery");
}

export async function siteReviews() {
  const { reviews } = await getContent();
  const real = reviews.filter((r) => !r.placeholder);
  return {
    reviews,
    count: real.length,
    average: real.length ? Math.round((real.reduce((s, r) => s + r.rating, 0) / real.length) * 10) / 10 : null,
  };
}
