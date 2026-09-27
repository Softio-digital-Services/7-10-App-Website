import type { Metadata } from "next";
import { Brackets } from "@/components/brand/brackets";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { InstagramIcon } from "@/components/icons";
import { LangSwitch } from "@/components/lang-switch";
import { NewsletterForm } from "@/components/newsletter-form";
import { SoonCountdown } from "@/components/soon-countdown";
import { getI18n } from "@/lib/i18n/server";
import { isBeforeLaunch, store } from "@/lib/store-config";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.soon.title, description: dict.soon.body };
}

export default async function SoonPage() {
  const { dict: t } = await getI18n();

  return (
    <main className="theme-olive relative isolate flex min-h-svh flex-col overflow-hidden">
      <span aria-hidden="true" className="text-outline pointer-events-none absolute -bottom-[0.18em] start-1/2 -z-10 -translate-x-1/2 select-none font-display text-[46vw] font-semibold leading-none rtl:translate-x-1/2" dir="ltr">
        7.10
      </span>

      <header className="container-x flex h-20 items-center justify-between">
        <Wordmark className="text-[15px]" />
        <LangSwitch />
      </header>

      <div className="container-x flex flex-1 flex-col items-center justify-center py-12 text-center">
        <div className="relative p-8 md:p-10">
          <Brackets size="md" inset="0" className="text-cream/50" />
          <LogoMark className="rise h-28 w-auto md:h-40" tone="silver" />
        </div>
        <p className="rise eyebrow mt-10 flex items-center gap-3 text-cream/75" style={{ animationDelay: "0.1s" }}>
          <span className="dot-signal pulse-signal" /> {t.soon.label}
        </p>
        <h1 className="rise display mt-4 text-[26vw] font-semibold leading-[0.85] sm:text-[11rem] md:text-[13rem]" style={{ animationDelay: "0.15s" }}>
          {t.soon.title}
        </h1>
        <p className="rise mt-6 max-w-md text-[16.5px] leading-relaxed text-cream/80" style={{ animationDelay: "0.2s" }}>
          {t.soon.body}
        </p>

        {isBeforeLaunch() && (
          <div className="rise mt-10 flex w-full justify-center" style={{ animationDelay: "0.25s" }}>
            <SoonCountdown target={store.launchAt} />
          </div>
        )}

        <div className="rise mt-12 w-full max-w-md text-start" style={{ animationDelay: "0.3s" }}>
          <p className="text-[14px] text-cream/75">{t.soon.notify}</p>
          <NewsletterForm tone="light" />
        </div>

        <a
          href={`https://instagram.com/${store.instagram}`}
          target="_blank"
          rel="noreferrer"
          className="rise mt-10 inline-flex items-center gap-3 text-[14px] text-cream/80 hover:text-cream"
          style={{ animationDelay: "0.35s" }}
        >
          <InstagramIcon className="h-5 w-5" /> {t.soon.follow} · <bdi dir="ltr">@{store.instagram}</bdi>
        </a>
      </div>

      <footer className="container-x flex h-16 items-center justify-between border-t border-cream/15 text-[12px] text-cream/60">
        <span className="font-display tracking-[0.3em] keep-tracking" dir="ltr">07 — 10 — 2026</span>
        <span>{t.footer.rights}</span>
      </footer>
    </main>
  );
}
