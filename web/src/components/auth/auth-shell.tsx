import Link from "next/link";
import { Check } from "lucide-react";
import { Brackets } from "@/components/brand/brackets";
import { LogoMark } from "@/components/brand/logo";
import { Img } from "@/components/img";
import { editorial } from "@/lib/editorial";
import type { Dict } from "@/lib/i18n/en";

type AuthShellProps = {
  t: Dict;
  title: string;
  body: string;
  children: React.ReactNode;
};

export function AuthShell({ t, title, body, children }: AuthShellProps) {
  return (
    <section className="container-x grid gap-10 py-10 md:py-16 lg:grid-cols-12 lg:gap-16">
      <aside className="relative isolate hidden overflow-hidden bg-charcoal text-cream lg:col-span-6 lg:flex lg:min-h-[640px] lg:flex-col lg:justify-between lg:p-12">
        <Img src={editorial.auth} alt="" fill sizes="50vw" className="-z-10 object-cover opacity-55" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal via-charcoal/30 to-transparent" />
        <Brackets size="lg" inset="1.5rem" className="text-cream/60" />
        <LogoMark className="h-14 w-auto self-start" tone="cream" />
        <div>
          <p className="eyebrow text-cream/70">{t.auth.perksLabel}</p>
          <ul className="mt-6 space-y-4">
            {t.auth.perks.map((perk) => (
              <li key={perk} className="flex items-center gap-4 text-[17px]">
                <span className="grid h-7 w-7 shrink-0 place-items-center border border-cream/40">
                  <Check className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex flex-col justify-center lg:col-span-6 lg:py-8 xl:px-8">
        <div className="mx-auto w-full max-w-md">
          <p className="eyebrow flex items-center gap-3 text-charcoal/60">
            <span className="dot-signal" /> {t.auth.accountLabel}
          </p>
          <h1 className="display mt-4 text-5xl md:text-6xl">{title}</h1>
          <p className="mt-4 text-[15.5px] leading-relaxed text-charcoal/70">{body}</p>
          <div className="mt-10">{children}</div>
          <div className="mt-10 flex items-start gap-3 border-t border-charcoal/10 pt-6 text-[13.5px] text-charcoal/60">
            <span className="mt-1.5 h-0 w-0 shrink-0 border-x-[4px] border-t-[7px] border-x-transparent border-t-signal" aria-hidden="true" />
            <p>
              {t.auth.guestHint}{" "}
              <Link href="/track" className="text-charcoal underline underline-offset-4">
                {t.common.track}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function safeCallback(raw: string | string[] | undefined, fallback = "/orders") {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login") || value.startsWith("/register")) return fallback;
  return value;
}
