import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { SectionHeading } from "@/components/brand/section-heading";
import { WhatsAppIcon } from "@/components/icons";
import { Img } from "@/components/img";
import { Reveal } from "@/components/reveal";
import { alternatesFor } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { siteImage } from "@/lib/site-content";
import { whatsappLink } from "@/lib/store-config";

export async function generateMetadata(): Promise<Metadata> {
  const { dict, locale } = await getI18n();
  return { alternates: alternatesFor("/about", locale), title: dict.common.about, description: dict.design.about.lead };
}

/** Value cards, in the design's order: white, olive, white, linen. */
const valueTones = ["bg-white text-charcoal", "bg-forest text-sand", "bg-white text-charcoal", "bg-sand text-[#313B2B]"];

export default async function AboutPage() {
  const { dict, locale } = await getI18n();
  const t = dict.design.about;
  const altLang = locale === "ar" ? "en" : "ar";
  const altFont = altLang === "ar" ? "font-[Changa] font-bold" : "display";
  const photo = await siteImage("about");

  return (
    <>
      {/* WHO ARE WE */}
      <section className="theme-olive">
        <div className="container-x grid items-center gap-12 py-16 md:py-24 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <span className="rise eyebrow text-khaki-60">{t.eyebrow}</span>
            <h1 className="display text-[clamp(64px,8vw,120px)] leading-[0.92] text-white">
              <span className="line-mask">
                <span style={{ "--d": "0.08s" } as React.CSSProperties}>
                  {t.title}
                  <span className="font-display font-bold">?</span>
                </span>
              </span>
            </h1>
            <p lang={altLang} aria-hidden="true" className={`rise text-[40px] leading-tight text-sand md:text-[56px] ${altFont}`} style={{ animationDelay: "0.2s" }}>
              {t.alt}
            </p>
            <p className="rise max-w-xl text-[20px] font-bold leading-relaxed text-white" style={{ animationDelay: "0.28s" }}>
              {t.lead}
            </p>
            <p className="rise max-w-xl text-[16px] leading-relaxed text-sand" style={{ animationDelay: "0.34s" }}>
              {t.body}
            </p>
            {locale !== "ar" && (
              <p lang="ar" dir="rtl" className="rise max-w-xl text-[15px] leading-loose text-khaki-60" style={{ animationDelay: "0.4s" }}>
                {t.bodyAr}
              </p>
            )}
          </div>

          <div className="rise relative grid min-h-[420px] place-items-center overflow-hidden rounded-[10px] bg-sand md:min-h-[520px]" style={{ animationDelay: "0.2s" }}>
            {photo?.src && <Img src={photo.src} alt="" fill priority sizes="(min-width:1024px) 45vw, 100vw" className="object-cover" />}
            <span className="topo topo-drift pointer-events-none absolute inset-0 opacity-50 mix-blend-multiply" aria-hidden="true" />
            <span className="absolute start-5 top-5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#313B2B]">
              {photo ? (locale === "ar" ? photo.captionAr : photo.captionEn) || t.photoTag : t.photoTag}
            </span>
            <div className="absolute inset-x-5 bottom-5 flex items-center justify-between gap-4 rounded-[10px] bg-white/85 px-5 py-4 text-[#313B2B] backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <Logo variant="mark" className="h-8 w-auto" />
                <div>
                  <span className="eyebrow block text-[10px] text-ash">{t.essence}</span>
                  <span className="display block text-[26px]">{t.essenceTitle}</span>
                </div>
              </div>
              <span lang={altLang} className={`text-[22px] ${altFont}`}>
                {t.essenceAlt}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section className="container-x py-20 md:py-24">
        <Reveal>
          <SectionHeading label={<span className="eyebrow text-signal">{t.whyEyebrow}</span>} title={t.whyTitle + "?"} alt={t.whyAlt} locale={locale} />
        </Reveal>
        <ol className="mt-8 grid border-t-2 border-charcoal md:grid-cols-3">
          {t.why.map(([en, ar], i) => (
            <Reveal key={en} as="li" delay={(i % 3) * 0.06} className="flex gap-4 border-b border-hairline py-7 md:pe-8">
              <span className="display w-14 shrink-0 text-[44px] leading-none text-signal" dir="ltr">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="text-[18px] font-bold leading-snug">{locale === "ar" ? ar : en}</p>
                <p lang={altLang} className="mt-2 text-[15px] text-ash">
                  {locale === "ar" ? en : ar}
                </p>
              </div>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* MISSION + VISION */}
      <section className="container-x grid gap-5 pb-20 md:grid-cols-2 md:pb-24" aria-label={`${t.missionTitle} · ${t.visionTitle}`}>
        <Reveal className="relative flex flex-col gap-5 overflow-hidden rounded-[10px] bg-sand p-8 text-[#313B2B] md:p-10">
          <span className="eyebrow text-ash">{t.missionEyebrow}</span>
          <h2 className="display text-[clamp(44px,5vw,64px)]">{t.missionTitle}</h2>
          <p className="text-[19px] leading-relaxed">{t.mission}</p>
          {locale !== "ar" && (
            <p lang="ar" dir="rtl" className="relative z-[1] mt-auto pt-8 text-[15px] leading-loose text-ash">
              {t.missionAr}
            </p>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/graphics/ridgelines.svg" alt="" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 w-full opacity-40" />
        </Reveal>
        <Reveal delay={0.08} className="flex flex-col gap-5 rounded-[10px] bg-forest p-8 text-sand md:p-10">
          <span className="eyebrow text-khaki-60">{t.visionEyebrow}</span>
          <h2 className="display text-[clamp(44px,5vw,64px)] text-white">{t.visionTitle}</h2>
          <p className="text-[19px] leading-relaxed text-white">{t.vision}</p>
          {locale !== "ar" && (
            <p lang="ar" dir="rtl" className="mt-auto pt-8 text-[15px] leading-loose text-khaki-60">
              {t.visionAr}
            </p>
          )}
        </Reveal>
      </section>

      {/* VALUES */}
      <section className="bg-stone">
        <div className="container-x py-20 md:py-24">
          <Reveal>
            <SectionHeading label={<span className="eyebrow text-signal">{t.valuesEyebrow}</span>} title={t.valuesTitle} alt={t.valuesAlt} locale={locale} />
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.values.map(([en, ar, line], i) => (
              <Reveal key={en} delay={i * 0.06} className={`rh-tile flex min-h-[260px] flex-col rounded-[10px] p-6 ${valueTones[i % 4]}`}>
                <span className={`text-[11px] font-bold ${i === 1 ? "text-khaki-60" : "text-signal"}`} dir="ltr">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="display mt-3 text-[30px]">{locale === "ar" ? ar : en}</h3>
                <p lang={altLang} className={`mt-1 text-[24px] ${altFont}`}>
                  {locale === "ar" ? en : ar}
                </p>
                <p className={`mt-auto border-t pt-4 text-[15px] ${i === 1 ? "border-olive-card text-sand" : "border-hairline"}`}>{line}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* QUOTE */}
      <section className="relative overflow-hidden bg-khaki">
        <span className="topo topo-drift pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="container-x relative py-[104px] text-center">
          <Reveal>
            <p className="display mx-auto max-w-[1000px] text-[clamp(36px,4.4vw,60px)] leading-[1.45] text-[#313B2B]">
              <span className="highlight-box px-3">{dict.design.quote}</span>
            </p>
            <p lang={altLang} className={`mt-7 text-white ${altLang === "ar" ? "font-[Changa] text-[30px] font-bold" : "display text-[28px]"}`}>
              {dict.design.quoteAlt}
            </p>
          </Reveal>
        </div>
      </section>

      {/* GO FURTHER */}
      <section className="container-x flex flex-col gap-8 py-16 md:flex-row md:items-center md:justify-between md:py-20">
        <Reveal>
          <h2 className="display text-[clamp(48px,6vw,88px)]">{t.ctaTitle}</h2>
          <p lang={altLang} className={`mt-2 text-[28px] ${altFont}`}>
            {t.ctaAlt}
          </p>
          <p className="mt-3 text-[16px] text-ash">{t.ctaBody}</p>
        </Reveal>
        <Reveal delay={0.08} className="flex flex-col gap-3 sm:flex-row">
          <Link href="/help#size-guide" className="btn btn-primary min-h-[52px] px-7 text-[16px]">
            {t.ctaFit}
          </Link>
          <a href={whatsappLink()} target="_blank" rel="noreferrer" className="btn btn-outline min-h-[52px] px-7 text-[16px]">
            <WhatsAppIcon className="h-5 w-5" /> {t.ctaWhatsApp}
          </a>
        </Reveal>
      </section>
    </>
  );
}
