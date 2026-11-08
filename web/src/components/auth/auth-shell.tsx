import Link from "next/link";
import { Check } from "lucide-react";
import type { Dict } from "@/lib/i18n/en";

type AuthShellProps = {
  t: Dict;
  title: string;
  body: string;
  active: "signin" | "register";
  children: React.ReactNode;
};

export function AuthShell({ t, title, body, active, children }: AuthShellProps) {
  const tabs = [
    { key: "signin", href: "/login", label: t.ui.signInTab },
    { key: "register", href: "/register", label: t.ui.createTab },
  ] as const;
  return (
    <section className="container-x grid gap-6 pb-12 lg:grid-cols-12 lg:gap-6 lg:py-10">
      <aside className="theme-olive -mx-4 flex flex-col px-5 pb-8 pt-7 md:-mx-8 md:px-8 lg:col-span-6 lg:mx-0 lg:min-h-[620px] lg:rounded-lg lg:p-10">
        <p className="rise eyebrow text-khaki-60">{t.design.auth.eyebrow}</p>
        <h1 className="display mt-3 text-[3rem] leading-[0.92] text-white md:text-[4.4rem]">
          <span className="line-mask">
            <span style={{ "--d": "0.05s" } as React.CSSProperties}>{title}</span>
          </span>
        </h1>
        <p className="rise mt-4 max-w-md text-[15px] leading-relaxed text-cream/85" style={{ animationDelay: "0.15s" }}>
          {body}
        </p>
        <ul className="mt-10 hidden border-t border-cream/15 lg:mt-auto lg:block">
          {t.design.auth.perks.map(([title, line], i) => (
            <li key={title} className="rise flex items-start gap-4 border-b border-cream/15 py-4" style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-signal text-white">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <span>
                <b className="block text-[16px] text-white">{title}</b>
                <span className="text-[14px] text-sand">{line}</span>
              </span>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex flex-col justify-center lg:col-span-6 lg:rounded-lg lg:border lg:border-charcoal/12 lg:p-10">
        <div className="mx-auto w-full max-w-md">
          <div className="grid grid-cols-2 rounded-lg bg-[#ecebe4] p-1">
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={active === tab.key ? "page" : undefined}
                className={`grid h-11 place-items-center rounded-md text-[15px] font-bold transition-[background-color,color,box-shadow] duration-300 ${
                  active === tab.key ? "bg-white text-charcoal shadow-[0_1px_3px_rgba(47,58,44,0.25)]" : "text-charcoal/65 hover:text-charcoal"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <div className="mt-7">{children}</div>
          <div className="mt-7 rounded-lg bg-stone px-4 py-3.5 text-[14px] text-charcoal/85">
            {t.ui.guestQ}{" "}
            <Link href="/cart" className="font-bold text-charcoal underline underline-offset-4">
              {t.ui.guestLink}
            </Link>{" "}
            {t.ui.guestTail}
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
