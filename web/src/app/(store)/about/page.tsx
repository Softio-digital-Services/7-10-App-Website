import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Brackets } from "@/components/brand/brackets";
import { LogoMark } from "@/components/brand/logo";
import { SectionLabel } from "@/components/brand/section-label";
import { Countdown } from "@/components/countdown";
import { Img } from "@/components/img";
import { Reveal } from "@/components/reveal";
import { editorial } from "@/lib/editorial";
import { getI18n } from "@/lib/i18n/server";
import { isBeforeLaunch, store } from "@/lib/store-config";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.common.about, description: dict.about.intro };
}

export default async function AboutPage() {
  const { dict: t } = await getI18n();
  const beforeLaunch = isBeforeLaunch();

  return (
    <>
      {/* HERO */}
      <section className="relative isolate -mt-16 overflow-hidden bg-charcoal text-cream md:-mt-[76px]">
        <Img src={editorial.aboutHero} alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-60" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal via-charcoal/40 to-charcoal/30" />
        <div className="container-x flex min-h-[92svh] flex-col justify-end pb-16 pt-32 md:pb-24">
          <p className="rise eyebrow flex items-center gap-3 text-cream/70">
            <span className="dot-signal pulse-signal" /> {t.about.label}
          </p>
          <h1 className="rise display mt-6 max-w-5xl text-[13vw] font-semibold sm:text-7xl md:text-[7.5rem]" style={{ animationDelay: "0.1s" }}>
            {t.about.title}
          </h1>
          <p className="rise mt-8 max-w-2xl text-[17px] leading-relaxed text-cream/80 md:text-lg" style={{ animationDelay: "0.2s" }}>
            {t.about.intro}
          </p>
        </div>
      </section>

      {/* MANIFESTO */}
      <section className="theme-olive relative overflow-hidden">
        <div className="container-x py-20 md:py-32">
          <Reveal>
            <SectionLabel index="01" tone="light">{t.about.manifestoLabel}</SectionLabel>
          </Reveal>
          <ol className="mt-14 space-y-4 md:space-y-2">
            {t.about.manifesto.map((line, i) => (
              <Reveal key={i} delay={i * 0.08} as="li" className="grid items-baseline gap-4 border-t border-cream/15 py-8 md:grid-cols-12 md:gap-8 md:py-10">
                <span className="text-outline font-display text-7xl font-semibold leading-none md:col-span-2 md:text-8xl" dir="ltr">
                  0{i + 1}
                </span>
                <p className="display text-3xl leading-[1.05] md:col-span-10 md:text-5xl lg:text-6xl">{line}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* VALUES */}
      <section className="container-x py-20 md:py-32">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal>
              <SectionLabel index="02">{t.about.valuesLabel}</SectionLabel>
            </Reveal>
            <div className="mt-10 divide-y divide-charcoal/10 border-y border-charcoal/10">
              {t.about.values.map((v, i) => (
                <Reveal key={v.title} delay={i * 0.06} className="flex gap-6 py-8">
                  <span className="font-display text-[12px] text-charcoal/40" dir="ltr">[0{i + 1}]</span>
                  <div>
                    <h3 className="display text-3xl md:text-4xl">{v.title}</h3>
                    <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-charcoal/70">{v.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:col-span-7">
            <Reveal className="card-img relative row-span-2 aspect-[3/5]">
              <Img src={editorial.aboutGrid[0]} alt="" fill sizes="(min-width:1024px) 30vw, 50vw" className="object-cover" />
            </Reveal>
            <Reveal delay={0.08} className="card-img relative aspect-[4/5]">
              <Img src={editorial.aboutGrid[1]} alt="" fill sizes="(min-width:1024px) 30vw, 50vw" className="object-cover" />
            </Reveal>
            <Reveal delay={0.16} className="relative grid aspect-[4/5] place-items-center bg-olive text-cream/70">
              <Brackets size="sm" inset="1rem" />
              <LogoMark className="h-20 w-auto md:h-28" tone="silver" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* LAUNCH */}
      <section className="relative overflow-hidden bg-charcoal text-cream">
        <span aria-hidden="true" className="text-outline pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center font-display text-[24vw] font-semibold leading-none opacity-60" dir="ltr">
          07.10.26
        </span>
        <div className="container-x relative grid gap-12 py-20 md:py-32 lg:grid-cols-2 lg:items-end">
          <Reveal>
            <SectionLabel index="03" tone="light">{t.about.dateLabel}</SectionLabel>
            <p className="display mt-6 text-5xl md:text-7xl">{t.about.dateBody}</p>
          </Reveal>
          <Reveal delay={0.1} className="flex flex-col items-start gap-8 lg:justify-self-end">
            {beforeLaunch && <Countdown target={store.launchAt} />}
            <Link href="/shop" className="btn btn-cream">
              {t.about.cta} <ArrowRight className="flip-rtl h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
