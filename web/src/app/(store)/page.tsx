import type { Metadata } from "next";
import { Img as Image } from "@/components/img";
import Link from "next/link";
import { SectionHeading } from "@/components/brand/section-heading";
import { WhatsAppIcon } from "@/components/icons";
import { NewsletterForm } from "@/components/newsletter-form";
import { ProductCard } from "@/components/product-card";
import { Reveal } from "@/components/reveal";
import { getCategories, getProducts } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { alternatesFor, fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { siteFacts, siteGallery, siteImage, siteReviews } from "@/lib/site-content";
import { store, whatsappLink } from "@/lib/store-config";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { alternates: alternatesFor("/", locale) };
}

const organizationLd = {
  "@context": "https://schema.org",
  "@type": "ClothingStore",
  name: "7.10 Brand",
  url: store.siteUrl,
  logo: `${store.siteUrl}/icon.png`,
  image: `${store.siteUrl}/opengraph-image.png`,
  ...(store.email ? { email: store.email } : {}),
  ...(store.phone ? { telephone: store.phone } : {}),
  address: { "@type": "PostalAddress", addressCountry: "LB", ...(store.address ? { streetAddress: store.address } : {}) },
  sameAs: store.instagram ? [`https://instagram.com/${store.instagram}`] : [],
};

/** Category tile colours, in the design's order: linen, olive, khaki, soft. */
const tileTones = [
  { bg: "bg-[#D5D4C2]", ink: "text-[#313B2B]" },
  { bg: "bg-[#313B2B]", ink: "text-[#D5D4C2]" },
  { bg: "bg-[#8A8863]", ink: "text-[#FFFFFF]" },
  { bg: "bg-[#F4F3EC]", ink: "text-[#313B2B]" },
];

const spanClass: Record<string, string> = {
  large: "col-span-2 row-span-2",
  tall: "row-span-2",
  wide: "col-span-2",
  normal: "",
};

function Stars({ n, size = 16, label }: { n: number; size?: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill={i < n ? "#B51515" : "#D5D4C2"} />
        </svg>
      ))}
    </span>
  );
}

export default async function HomePage() {
  const { dict, locale } = await getI18n();
  const t = dict.design;
  const altLang = locale === "ar" ? "en" : "ar";
  const [products, categories, fact, hero, fabric, gallery, reviewData] = await Promise.all([
    getProducts({ sort: "new" }, locale),
    getCategories(locale),
    siteFacts(locale),
    siteImage("hero"),
    siteImage("fabric"),
    siteGallery(),
    siteReviews(),
  ]);

  // One card per style: the first colour stands in for the rest, which show as swatches.
  const seen = new Set<string>();
  const olive = (p: (typeof products)[number]) => (p.colorName?.toLowerCase() === "olive" ? 0 : 1);
  const perStyle = [...products].sort((a, b) => olive(a) - olive(b)).filter((p) => {
    const key = p.styleCode || p.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const fresh = [...perStyle.filter((p) => p.isNew), ...perStyle.filter((p) => !p.isNew)].slice(0, 8);
  const heroCaption = hero ? (locale === "ar" ? hero.captionAr : hero.captionEn) : "";
  const heroProduct =
    perStyle.find((p) => heroCaption && p.name.toLowerCase() === heroCaption.toLowerCase()) ?? perStyle.find((p) => p.featured) ?? perStyle[0];
  const catSlug = (re: RegExp) => categories.find((c) => re.test(c.slug))?.slug;
  const women = catSlug(/^women/);
  const men = catSlug(/^men/);
  const handle = fact("instagram_handle", store.instagram ? `@${store.instagram}` : "[@7.10]");
  const reviews = reviewData.reviews.slice(0, 3);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd).replace(/</g, "\\u003c") }} />

      {/* HERO */}
      <section className="theme-olive overflow-hidden">
        <div className="container-x flex flex-wrap items-center gap-12 pb-20 pt-14 md:pb-[88px] md:pt-20">
          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-6">
            <span className="rise eyebrow text-khaki-60">{t.hero.eyebrow}</span>
            <h1 className="display text-[clamp(64px,9vw,136px)] leading-[0.92] text-white">
              <span className="line-mask">
                <span style={{ "--d": "0.08s" } as React.CSSProperties}>{t.hero.titleA}</span>
              </span>
              <span className="line-mask">
                <span style={{ "--d": "0.2s" } as React.CSSProperties}>{t.hero.titleB}</span>
              </span>
            </h1>
            <p
              lang={altLang}
              aria-hidden="true"
              className={`rise text-sand ${altLang === "ar" ? "font-[Changa] text-[clamp(40px,5vw,64px)] font-extrabold leading-[1.2]" : "display text-[clamp(32px,4vw,52px)]"}`}
              style={{ animationDelay: "0.3s" }}
            >
              {t.hero.alt}
            </p>
            <p className="rise max-w-[460px] text-[18px] leading-relaxed text-sand" style={{ animationDelay: "0.38s" }}>
              {t.hero.body}
            </p>
            <div className="rise mt-2 flex flex-wrap gap-3" style={{ animationDelay: "0.46s" }}>
              <Link href={women ? `/shop?c=${women}` : "/shop"} className="btn btn-primary min-h-[52px] px-7 text-[16px]">
                {t.hero.shopWomen}
              </Link>
              <Link href={men ? `/shop?c=${men}` : "/shop"} className="btn btn-outline-cream min-h-[52px] px-7 text-[16px]">
                {t.hero.shopMen}
              </Link>
            </div>
          </div>

          <div className="rise relative grid min-h-[420px] min-w-0 flex-[1.3_1_520px] place-items-center overflow-hidden rounded-[10px] bg-sand md:min-h-[560px]" style={{ animationDelay: "0.2s" }}>
            {hero?.src ? (
              <Image src={hero.src} alt="" fill priority sizes="(min-width:1024px) 55vw, 100vw" className="object-cover" />
            ) : heroProduct?.images[0] ? (
              <Image src={heroProduct.images[0]} alt="" fill priority sizes="(min-width:1024px) 55vw, 100vw" className="object-cover" />
            ) : null}
            <span className="topo topo-drift pointer-events-none absolute inset-0 opacity-60 mix-blend-multiply" aria-hidden="true" />
            <span className="absolute start-5 top-5 rounded-full bg-[#FFFFFF] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#313B2B]">
              {t.hero.campaignTag}
            </span>
            {heroProduct && (
              <div className="absolute inset-x-5 bottom-5 flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-white/80 px-4 py-3.5 text-[#313B2B] backdrop-blur-xl">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-[16px] font-bold">{heroProduct.name}</span>
                  <span className="truncate text-[14px] text-[#55584A]">
                    {[heroProduct.spec, formatPrice(heroProduct.price)].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <Link href={`/products/${heroProduct.slug}`} className="btn btn-dark min-h-11 px-[18px] text-[14px]">
                  {t.hero.shopLook}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      {categories.length > 0 && (
        <section id="categories" className="container-x pb-10 pt-[88px]">
          <Reveal>
            <SectionHeading title={t.categoriesTitle} alt={t.categoriesAlt} locale={locale} />
          </Reveal>
          <div className="mt-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {categories.slice(0, 4).map((c, i) => {
              const tone = tileTones[i % tileTones.length];
              return (
                <Reveal key={c.slug} delay={i * 0.06}>
                  <Link
                    href={`/shop?c=${c.slug}`}
                    className={`rh-tile relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[10px] p-4 md:p-6 ${tone.bg} ${tone.ink}`}
                  >
                    {c.image && <Image src={c.image} alt="" fill sizes="(min-width:1024px) 22vw, 46vw" className="object-cover" />}
                    <span className="relative flex items-baseline justify-between gap-2">
                      <span className="font-display text-[22px] font-bold uppercase leading-none md:text-[30px]">{c.name}</span>
                      {c.altName && (
                        <span lang={altLang} className={altLang === "ar" ? "font-[Changa] text-[15px] font-bold md:text-[18px]" : "font-display text-[15px] font-bold uppercase md:text-[18px]"}>
                          {c.altName}
                        </span>
                      )}
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      {/* NEW THIS SEASON */}
      <section id="new-in" className="container-x pb-24 pt-14">
        <Reveal>
          <SectionHeading
            title={t.newTitle}
            alt={t.newAlt}
            locale={locale}
            aside={
              <Link href="/shop?sort=new" className="text-[16px] font-bold underline underline-offset-4 hover:text-signal">
                {t.shopAllNew}
              </Link>
            }
          />
        </Reveal>
        {fresh.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-5 lg:grid-cols-4">
            {fresh.map((p, i) => (
              <Reveal key={p.id} delay={(i % 4) * 0.05} className="h-full">
                <ProductCard product={p} index={i} sizes="(min-width:1024px) 24vw, 48vw" />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-[10px] bg-stone px-6 py-16 text-center">
            <p className="display text-4xl">{dict.shop.comingSoonTitle}</p>
            <p className="mx-auto mt-4 max-w-md text-ash">{dict.shop.comingSoonBody}</p>
            <div className="mx-auto mt-8 max-w-md">
              <NewsletterForm tone="dark" />
            </div>
          </div>
        )}
      </section>

      {/* MODEST CUTS */}
      <section className="theme-olive">
        <div className="container-x flex flex-wrap items-center gap-14 py-24">
          <Reveal className="relative grid aspect-[4/3] min-w-0 flex-[1_1_420px] place-items-center overflow-hidden rounded-[10px] bg-olive-card">
            {fabric?.src && <Image src={fabric.src} alt="" fill sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" />}
            <span className="absolute start-4 top-4 rounded-full bg-[#D5D4C2] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#313B2B]">{t.modest.tag}</span>
          </Reveal>
          <Reveal delay={0.08} className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
            <span className="eyebrow text-khaki-60">{t.modest.eyebrow}</span>
            <h2 className="display text-[clamp(44px,5vw,72px)] text-white">{t.modest.title}</h2>
            <p className="text-[17px] leading-relaxed">{t.modest.body}</p>
            <ul className="grid">
              {[
                [t.modest.coverage, t.modest.coverageV],
                [t.modest.fabric, fact("fabric_spec", "[Fabric spec]")],
                [t.modest.tested, t.modest.testedV],
              ].map(([k, v], i) => (
                <li key={k} className={`flex justify-between gap-4 border-t border-olive-card py-3.5 ${i === 2 ? "border-b" : ""}`}>
                  <span>{k}</span>
                  <span className="text-end text-white">{v}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* VALUES */}
      <section className="bg-stone">
        <div className="container-x grid gap-10 py-[72px] md:grid-cols-3">
          {t.values.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.06} className="flex flex-col gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/brand/icons/${v.icon}.svg`} alt="" aria-hidden="true" className="h-14 w-14" />
              <h3 className="font-display text-[28px] font-bold uppercase leading-[1.05]">{v.title}</h3>
              <p className="text-[15px] leading-relaxed text-ash">{v.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ORDER YOUR WAY */}
      <section className="container-x py-24">
        <Reveal>
          <SectionHeading title={t.order.title} alt={t.order.alt} locale={locale} />
        </Reveal>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[
            { n: "01", title: t.order.codTitle, body: t.order.codBody, icon: "shipping" },
            { n: "02", title: t.order.whishTitle, body: t.order.whishBody, icon: "returns" },
          ].map((c, i) => (
            <Reveal key={c.n} delay={i * 0.06} className="rh-tile flex h-full flex-col gap-3.5 rounded-[10px] border-[1.5px] border-charcoal p-6 md:p-8">
              <div className="flex items-center gap-3 md:block">
                <span className="display block text-[44px] leading-none text-signal md:text-[64px]" dir="ltr">
                  {c.n}
                </span>
                <h3 className="font-display text-[24px] font-bold uppercase leading-none md:mt-3.5 md:text-[30px]">{c.title}</h3>
              </div>
              <p className="text-[15px] leading-relaxed text-ash">{c.body}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/brand/icons/${c.icon}.svg`} alt="" aria-hidden="true" className="mt-auto hidden h-14 w-14 md:block" />
            </Reveal>
          ))}
          <Reveal delay={0.12} className="flex h-full flex-col gap-3.5 rounded-[10px] bg-sand p-6 md:p-8">
            <span className="display text-[44px] leading-none text-signal md:text-[64px]" dir="ltr">
              03
            </span>
            <h3 className="display text-[32px] leading-none md:text-[40px]">{t.order.sizeTitle}</h3>
            <p className="text-[15px] leading-relaxed">{t.order.sizeBody}</p>
            <a href={whatsappLink()} target="_blank" rel="noreferrer" className="btn btn-primary mt-auto min-h-[52px] w-fit px-6">
              <WhatsAppIcon className="h-5 w-5" /> {t.order.sizeCta}
            </a>
          </Reveal>
        </div>
      </section>

      {/* QUOTE */}
      <section className="relative overflow-hidden bg-khaki">
        <span className="topo topo-drift pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="container-x relative flex max-w-[1080px] flex-col items-center gap-7 py-[104px] text-center">
          <Reveal>
            <p className="display text-[clamp(36px,4.4vw,60px)] leading-[1.45] text-[#313B2B]">
              <span className="highlight-box px-3">{t.quote}</span>
            </p>
            <p lang={altLang} className={`mt-7 text-white ${altLang === "ar" ? "font-[Changa] text-[30px] font-bold leading-normal" : "display text-[28px]"}`}>
              {t.quoteAlt}
            </p>
          </Reveal>
        </div>
      </section>

      {/* GALLERY */}
      {gallery.length > 0 && (
        <section id="gallery" aria-labelledby="gallery-title" className="container-x pt-24">
          <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
            <div className="flex max-w-[620px] flex-col gap-3.5">
              <span className="eyebrow text-signal">{t.gallery.eyebrow}</span>
              <h2 id="gallery-title" className="display text-[clamp(48px,6vw,88px)]">
                {t.gallery.title}
              </h2>
              <p className="text-[17px] leading-relaxed text-ash">{fmt(t.gallery.body, { handle })}</p>
            </div>
            <div className="flex flex-col items-start gap-3.5 md:items-end">
              <span lang={altLang} className={`hidden sm:block ${altLang === "ar" ? "font-[Changa] text-[32px] font-bold" : "display text-[28px]"}`}>
                {t.gallery.alt}
              </span>
              {store.instagram && (
                <a href={`https://instagram.com/${store.instagram}`} target="_blank" rel="noreferrer" className="btn btn-outline min-h-12 px-5">
                  {t.gallery.cta}
                </a>
              )}
            </div>
          </Reveal>
          <div className="grid auto-rows-[160px] grid-cols-2 gap-3 md:auto-rows-[220px] md:grid-cols-4">
            {gallery.map((g, i) => {
              const caption = locale === "ar" ? g.captionAr : g.captionEn;
              return (
                <Reveal key={i} delay={(i % 4) * 0.05} className={`rh-tile relative overflow-hidden rounded-[10px] bg-sand ${spanClass[g.span] ?? ""}`}>
                  <figure className="absolute inset-0 m-0">
                    {g.src && <Image src={g.src} alt={caption} fill sizes="(min-width:768px) 50vw, 100vw" className="object-cover" />}
                    {caption && (
                      <figcaption className="absolute bottom-3.5 start-3.5 max-w-[calc(100%-28px)] rounded-md bg-white/90 px-3 py-1.5 text-[13px] font-bold leading-tight text-[#313B2B] backdrop-blur">
                        {caption}
                      </figcaption>
                    )}
                  </figure>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      {/* REVIEWS */}
      {reviews.length > 0 && (
        <section id="reviews" aria-labelledby="reviews-title" className="container-x py-24">
          <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="flex flex-col gap-3">
              <h2 id="reviews-title" className="display text-[clamp(40px,5vw,64px)]">
                {t.reviews.title}
              </h2>
              <div className="flex items-center gap-2.5 text-[15px] text-ash">
                <Stars n={Math.round(reviewData.average ?? 5)} label={fmt(t.reviews.rating, { n: reviewData.average ?? "[4.9]" })} />
                <span>
                  {reviewData.count > 0
                    ? fmt(t.reviews.average, { avg: reviewData.average ?? "", n: reviewData.count })
                    : fmt(t.reviews.average, { avg: "[4.9]", n: "[120]" })}
                </span>
              </div>
            </div>
            <span lang={altLang} className={`hidden sm:block ${altLang === "ar" ? "font-[Changa] text-[32px] font-bold" : "display text-[28px]"}`}>
              {t.reviews.alt}
            </span>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-3">
            {reviews.map((r, i) => (
              <Reveal key={r.id} delay={i * 0.06}>
                <figure lang={r.lang} dir={r.lang === "ar" ? "rtl" : "ltr"} className="m-0 flex h-full flex-col gap-4 rounded-[10px] bg-stone p-7">
                  <div className="flex items-center justify-between">
                    <Stars n={r.rating} size={18} label={fmt(t.reviews.rating, { n: r.rating })} />
                    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" className="rtl:-scale-x-100">
                      <path d="M4 18v-5.5C4 8.4 6.2 6 9.5 5.5l.6 1.6C8.2 7.8 7.4 9.2 7.3 11H10v7H4zm10 0v-5.5c0-4.1 2.2-6.5 5.5-7l.6 1.6c-1.9.7-2.7 2.1-2.8 3.9H20v7h-6z" fill="#B51515" />
                    </svg>
                  </div>
                  <blockquote className="m-0 text-[17px] leading-relaxed">{r.quote}</blockquote>
                  {r.product && (
                    <span className="self-start rounded-full bg-white px-3 py-1.5 text-[12px] font-bold">
                      {fmt(reviewLabels[r.lang].bought, { product: r.product })}
                    </span>
                  )}
                  <figcaption className="mt-auto flex items-center gap-3 border-t border-hairline pt-4">
                    <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest text-[15px] font-bold text-sand">
                      {r.placeholder ? (r.lang === "ar" ? "[ر]" : "[A]") : r.customer.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex flex-col">
                      <b className="text-[15px]">{r.customer}</b>
                      <span className="text-[13px] text-ash">
                        {[r.city, reviewLabels[r.lang].verified].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** Review cards keep their own language's labels whatever the page language. */
const reviewLabels = {
  en: { bought: "Bought: {product}", verified: "Verified buyer" },
  ar: { bought: "اشترى: {product}", verified: "مشتري موثّق" },
};
