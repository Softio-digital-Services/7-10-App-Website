import { Img as Image } from "@/components/img";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Banknote, RefreshCcw, Truck } from "lucide-react";
import { Brackets } from "@/components/brand/brackets";
import { LogoMark } from "@/components/brand/logo";
import { SectionLabel } from "@/components/brand/section-label";
import { Countdown } from "@/components/countdown";
import { WhatsAppIcon } from "@/components/icons";
import { Marquee } from "@/components/marquee";
import { NewsletterForm } from "@/components/newsletter-form";
import { ProductCard } from "@/components/product-card";
import { ProductRail } from "@/components/product-rail";
import { Reveal } from "@/components/reveal";
import { getCategories, getProducts } from "@/lib/catalog";
import { editorial } from "@/lib/editorial";
import { formatPrice } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { isBeforeLaunch, store } from "@/lib/store-config";

export default async function HomePage() {
  const { dict: t, locale } = await getI18n();
  const [products, categories] = await Promise.all([getProducts({ sort: "featured" }, locale), getCategories(locale)]);

  const newest = [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
  const featured = products.filter((p) => !p.soldOut).slice(0, 4);
  const heroProduct = products.find((p) => p.featured && !p.soldOut) ?? products[0];
  const beforeLaunch = isBeforeLaunch();

  return (
    <>
      {/* HERO */}
      <section className="theme-olive relative -mt-16 overflow-hidden md:-mt-[76px]">
        <span
          aria-hidden="true"
          className="text-outline pointer-events-none absolute inset-0 flex select-none items-center justify-center font-display text-[46vw] font-semibold leading-none md:text-[34vw]"
          dir="ltr"
        >
          7.10
        </span>

        <div className="container-x relative grid min-h-[100svh] items-center gap-12 pb-16 pt-28 md:pt-36 lg:grid-cols-12 lg:gap-8 lg:pb-20">
          <div className="lg:col-span-7">
            <p className="rise eyebrow flex items-center gap-3 text-cream/70" style={{ animationDelay: "0.1s" }}>
              <span className="dot-signal pulse-signal" />
              {t.home.heroLabel}
            </p>
            <h1
              className="rise display mt-6 text-[15.5vw] font-semibold leading-[0.95] sm:text-[11vw] lg:text-[5.9rem] xl:text-[7rem] 2xl:text-[7.6rem]"
              style={{ animationDelay: "0.22s" }}
            >
              <span className="block">{t.home.heroTitleA}</span>
              <span className="block">
                {t.home.heroTitleB}
                <span
                  className="ms-[0.18em] inline-block h-0 w-0 -translate-y-[0.08em] border-x-[0.17em] border-t-[0.28em] border-x-transparent border-t-signal align-middle"
                  aria-hidden="true"
                />
              </span>
            </h1>
            <p className="rise mt-7 max-w-lg text-[16px] leading-relaxed text-cream/80 md:text-[17px]" style={{ animationDelay: "0.36s" }}>
              {t.home.heroBody}
            </p>
            <div className="rise mt-9 flex flex-wrap gap-3" style={{ animationDelay: "0.48s" }}>
              <Link href="/shop" className="btn btn-cream">
                {t.home.ctaShop}
                <ArrowRight className="flip-rtl h-4 w-4" />
              </Link>
              <Link href="/about" className="btn btn-outline-cream">
                {t.home.ctaStory}
              </Link>
            </div>

            <div className="rise mt-12" style={{ animationDelay: "0.6s" }}>
              {beforeLaunch ? (
                <>
                  <p className="eyebrow mb-3 flex items-center gap-3 text-cream/60">
                    {t.home.countdownLabel}
                    <span className="font-display keep-tracking tracking-[0.35em] text-cream" dir="ltr">
                      07 — 10 — 2026
                    </span>
                  </p>
                  <Countdown target={store.launchAt} />
                </>
              ) : (
                <p className="inline-flex items-center gap-3 border border-cream/25 px-4 py-3 eyebrow text-cream">
                  <span className="dot-signal pulse-signal" />
                  {t.home.liveLabel}
                </p>
              )}
            </div>
          </div>

          <div className="relative lg:col-span-5">
            {heroProduct?.images[0] ? (
              <Link
                href={`/products/${heroProduct.slug}`}
                className="rise group relative mx-auto block aspect-[4/5] w-full max-w-md text-cream/70 lg:ms-auto lg:me-0"
                style={{ animationDelay: "0.35s" }}
              >
                <Brackets size="lg" inset="-1rem" />
                <div className="relative h-full w-full overflow-hidden bg-olive-card">
                  <Image
                    src={heroProduct.images[0]}
                    alt={heroProduct.name}
                    fill
                    priority
                    sizes="(min-width:1024px) 34vw, 90vw"
                    className="img-zoom object-cover"
                  />
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 font-display text-[10px] uppercase keep-tracking tracking-[0.3em] text-cream/90" dir="ltr">
                    <span>33.89° N — 35.50° E</span>
                    <span className="flex items-center gap-2">
                      <span className="dot-signal pulse-signal" /> REC
                    </span>
                  </div>
                </div>
                <div className="absolute -bottom-6 start-4 end-4 flex items-center justify-between gap-4 bg-cream p-4 text-charcoal shadow-xl md:start-auto md:-end-6 md:w-72">
                  <div className="min-w-0">
                    <p className="eyebrow text-[10px] text-charcoal/50">{heroProduct.category}</p>
                    <p className="truncate font-medium">{heroProduct.name}</p>
                    <p className="text-sm text-charcoal/70" dir="ltr">{formatPrice(heroProduct.price)}</p>
                  </div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center bg-charcoal text-cream transition-colors group-hover:bg-signal">
                    <ArrowUpRight className="flip-rtl h-5 w-5" />
                  </span>
                </div>
              </Link>
            ) : (
              <div className="rise relative mx-auto grid aspect-square w-full max-w-sm place-items-center text-cream/60">
                <Brackets size="lg" />
                <LogoMark className="h-48 w-auto md:h-64" tone="silver" />
              </div>
            )}
          </div>
        </div>

        <div className="container-x relative hidden items-center justify-between border-t border-cream/15 py-4 text-cream/60 md:flex">
          <span className="eyebrow">[ Drop 01 ]</span>
          <a href="#new-in" className="eyebrow flex items-center gap-2 hover:text-cream">
            {t.home.scroll} <ArrowDown className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      {/* TICKER */}
      <section className="border-y border-charcoal bg-charcoal py-5 text-cream md:py-7" aria-hidden="true">
        <Marquee
          items={["Utility", "Essentials", "Drop 01", "07.10.2026", "7.10 Brand"]}
          duration={30}
          itemClassName="display text-4xl md:text-6xl"
          separator={<span className="mx-6 inline-block h-0 w-0 border-x-[10px] border-t-[16px] border-x-transparent border-t-signal md:mx-10" />}
        />
      </section>

      {/* CATEGORIES */}
      {categories.length > 0 && (
        <section className="container-x py-20 md:py-28">
          <Reveal className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <SectionLabel index="01">{t.home.categoriesLabel}</SectionLabel>
              <h2 className="display mt-4 text-5xl md:text-7xl">{t.home.categoriesTitle}</h2>
            </div>
            <Link href="/shop" className="btn btn-outline btn-sm">
              {t.common.shopAll} <ArrowRight className="flip-rtl h-3.5 w-3.5" />
            </Link>
          </Reveal>

          <div className="mt-12 grid auto-rows-[260px] grid-cols-2 gap-3 md:auto-rows-[300px] md:grid-cols-4 md:gap-4">
            {categories.slice(0, 5).map((c, i) => (
              <Reveal
                key={c.slug}
                delay={i * 0.06}
                className={
                  i === 0
                    ? "col-span-2 row-span-2"
                    : categories.length === 2 && i === 1
                      ? "col-span-2 row-span-2"
                      : categories.length <= 3
                        ? "col-span-2"
                        : ""
                }
              >
                <Link href={`/shop?c=${c.slug}`} className="group relative block h-full overflow-hidden bg-cream-2 text-cream">
                  {c.image && (
                    <Image
                      src={c.image}
                      alt={c.name}
                      fill
                      sizes={i === 0 ? "(min-width:768px) 50vw, 100vw" : "(min-width:768px) 25vw, 50vw"}
                      className="img-zoom object-cover"
                    />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-charcoal/75 via-charcoal/10 to-transparent" />
                  <span className="absolute inset-4 opacity-0 transition-all duration-500 group-hover:inset-3 group-hover:opacity-100 md:inset-6 md:group-hover:inset-4">
                    <Brackets size="sm" inset="0" />
                  </span>
                  <span className="absolute start-4 top-4 font-display text-[11px] keep-tracking tracking-[0.25em] text-cream/80 md:start-6 md:top-6" dir="ltr">
                    [{String(i + 1).padStart(2, "0")}]
                  </span>
                  <span className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 md:inset-x-6 md:bottom-6">
                    <span>
                      <span className={`display block ${i === 0 ? "text-4xl md:text-6xl" : "text-2xl md:text-4xl"}`}>{c.name}</span>
                      <span className="mt-1 block text-[13px] text-cream/75">{fmt(c.count === 1 ? t.shop.countOne : t.shop.count, { n: c.count })}</span>
                    </span>
                    <span className="grid h-10 w-10 shrink-0 place-items-center border border-cream/40 transition-colors group-hover:border-cream group-hover:bg-cream group-hover:text-charcoal">
                      <ArrowUpRight className="flip-rtl h-4 w-4" />
                    </span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* NEW IN */}
      <section id="new-in" className={`container-x pb-20 md:pb-28 ${categories.length === 0 ? "pt-20 md:pt-28" : ""}`}>
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <SectionLabel index="02">{t.home.newInLabel}</SectionLabel>
            <h2 className="display mt-4 text-5xl md:text-7xl">{t.home.newInTitle}</h2>
          </div>
          {newest.length > 0 && (
            <Link href="/shop?sort=new" className="link-line eyebrow">
              {t.common.viewAll}
            </Link>
          )}
        </Reveal>
        <div className="mt-12">
          {newest.length > 0 ? (
            <ProductRail products={newest} />
          ) : (
            <div className="relative border border-charcoal/15 px-6 py-16 text-center md:py-24">
              <Brackets size="sm" inset="-1px" className="text-charcoal/60" />
              <p className="display text-4xl md:text-5xl">{t.shop.comingSoonTitle}</p>
              <p className="mx-auto mt-4 max-w-md text-charcoal/65">{t.shop.comingSoonBody}</p>
              <div className="mx-auto mt-8 max-w-md">
                <NewsletterForm tone="dark" />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* STORY */}
      <section className="theme-olive relative overflow-hidden">
        <div className="container-x grid items-center gap-14 py-20 md:py-28 lg:grid-cols-2 lg:gap-20">
          <Reveal className="relative text-cream/60">
            <Brackets size="lg" inset="-1rem" />
            <div className="relative aspect-[4/5] overflow-hidden bg-olive-card">
              <Image src={editorial.story} alt="" fill sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" />
            </div>
            <span className="absolute -bottom-5 end-6 bg-signal px-4 py-2 font-display text-[11px] uppercase keep-tracking tracking-[0.3em] text-white" dir="ltr">
              07.10.2026
            </span>
          </Reveal>
          <div>
            <Reveal>
              <SectionLabel index="03" tone="light">{t.home.storyLabel}</SectionLabel>
              <h2 className="display mt-5 text-5xl md:text-7xl">{t.home.storyTitle}</h2>
              <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-cream/80">{t.home.storyBody}</p>
            </Reveal>
            <Reveal delay={0.1} className="mt-12 grid grid-cols-3 border-y border-cream/15">
              {t.home.stats.map((s, i) => (
                <div key={s.label} className={`py-6 ${i > 0 ? "border-s border-cream/15 ps-4 md:ps-6" : ""}`}>
                  <p className="font-display text-4xl md:text-6xl" dir="ltr">{s.value}</p>
                  <p className="mt-2 text-[13px] leading-snug text-cream/70">{s.label}</p>
                </div>
              ))}
            </Reveal>
            <Reveal delay={0.2}>
              <Link href="/about" className="btn btn-outline-cream mt-10">
                {t.home.storyCta} <ArrowRight className="flip-rtl h-4 w-4" />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* MOST WANTED */}
      {featured.length > 0 && (
        <section className="container-x py-20 md:py-28">
          <Reveal className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <SectionLabel index="04">{t.home.featuredLabel}</SectionLabel>
              <h2 className="display mt-4 text-5xl md:text-7xl">{t.home.featuredTitle}</h2>
            </div>
            <Link href="/shop" className="link-line eyebrow">
              {t.common.viewAll}
            </Link>
          </Reveal>
          <div className="mt-12 grid grid-cols-2 gap-x-3 gap-y-10 md:gap-x-5 lg:grid-cols-4">
            {featured.map((p, i) => (
              <Reveal key={p.id} delay={i * 0.06}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* LOOKBOOK */}
      <section className="relative isolate overflow-hidden bg-charcoal text-cream">
        <Image src={editorial.lookbook} alt="" fill sizes="100vw" className="-z-10 object-cover opacity-70" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal/85 via-charcoal/30 to-charcoal/10" />
        <div className="container-x flex min-h-[80vh] flex-col justify-end py-16 md:min-h-[88vh] md:py-24">
          <Reveal className="max-w-3xl">
            <SectionLabel index="05" tone="light">{t.home.lookLabel}</SectionLabel>
            <h2 className="display mt-5 text-5xl md:text-8xl">{t.home.lookTitle}</h2>
            <Link href="/shop?c=outerwear" className="btn btn-cream mt-10">
              {t.home.lookCta} <ArrowRight className="flip-rtl h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* USPs */}
      <section className="border-y border-charcoal/10">
        <div className="mx-auto grid max-w-[1480px] grid-cols-2 gap-px bg-charcoal/10 lg:grid-cols-4">
          {[
            { icon: <Banknote className="h-6 w-6" strokeWidth={1.25} />, title: t.home.uspCodTitle, body: t.home.uspCodBody },
            { icon: <Truck className="h-6 w-6" strokeWidth={1.25} />, title: t.home.uspDeliveryTitle, body: fmt(t.home.uspDeliveryBody, { days: store.deliveryDays }) },
            { icon: <RefreshCcw className="h-6 w-6" strokeWidth={1.25} />, title: t.home.uspExchangeTitle, body: fmt(t.home.uspExchangeBody, { days: store.exchangeDays }) },
            { icon: <WhatsAppIcon className="h-6 w-6" />, title: t.home.uspSupportTitle, body: t.home.uspSupportBody },
          ].map((u, i) => (
            <Reveal
              key={u.title}
              delay={i * 0.06}
              className="bg-cream px-5 py-10 md:px-8 md:py-14 xl:px-12"
            >
              <div className="flex items-center justify-between">
                {u.icon}
                <span className="font-display text-[11px] text-charcoal/35" dir="ltr">0{i + 1}</span>
              </div>
              <p className="display mt-6 text-xl md:text-2xl">{u.title}</p>
              <p className="mt-2 text-[14px] text-charcoal/65">{u.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* JOIN */}
      <section className="relative overflow-hidden bg-olive-deep text-cream">
        <span
          aria-hidden="true"
          className="text-outline pointer-events-none absolute -bottom-[0.18em] end-0 select-none font-display text-[30vw] font-semibold uppercase leading-none md:text-[20vw]"
          dir="ltr"
        >
          Join
        </span>
        <div className="container-x relative grid gap-10 py-20 md:py-28 lg:grid-cols-2">
          <Reveal>
            <SectionLabel index="06" tone="light">{t.home.joinLabel}</SectionLabel>
            <h2 className="display mt-5 text-6xl md:text-8xl">{t.home.joinTitle}</h2>
          </Reveal>
          <Reveal delay={0.1} className="self-end">
            <p className="max-w-md text-[17px] text-cream/80">{t.home.joinBody}</p>
            <div className="mt-8 max-w-lg">
              <NewsletterForm tone="light" />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
