"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { useI18n } from "@/components/i18n-provider";
import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { store, whatsappLink } from "@/lib/store-config";
import type { StoreCategory } from "@/lib/catalog";
import { useLockBody } from "@/components/use-lock-body";

type MobileMenuProps = {
  open: boolean;
  onClose: () => void;
  categories: StoreCategory[];
  isStaff: boolean;
  signedIn: boolean;
};

export function MobileMenu({ open, onClose, categories, isStaff, signedIn }: MobileMenuProps) {
  const { t, locale, setLocale } = useI18n();
  useLockBody(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const primary = [
    { href: "/shop", label: t.common.shopAll },
    { href: "/shop?sort=new", label: t.common.newIn },
    ...categories.map((c) => ({ href: `/shop?c=${c.slug}`, label: c.name })),
  ];

  const secondary = [
    { href: "/about", label: t.common.about },
    { href: "/track", label: t.common.track },
    { href: "/help", label: t.common.help },
    { href: "/contact", label: t.common.contact },
    signedIn
      ? { href: isStaff ? "/admin" : "/orders", label: isStaff ? t.common.admin : t.common.myOrders }
      : { href: "/login", label: t.common.signIn },
  ];

  return (
    <div
      className={`fixed inset-0 z-[60] lg:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
      inert={!open}
      role="dialog"
      aria-modal="true"
      aria-label={t.common.menu}
    >
      <div
        className={`absolute inset-0 bg-charcoal/50 transition-opacity duration-500 ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={`theme-olive absolute inset-y-0 start-0 flex w-full max-w-md flex-col transition-transform duration-700 ease-[var(--ease-out-expo)] ${
          open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-cream/15 px-5">
          <Link href="/" onClick={onClose} className="flex items-center gap-3">
            <LogoMark className="h-7 w-auto" tone="silver" />
            <span className="font-display text-sm font-semibold uppercase keep-tracking tracking-[0.3em]" dir="ltr">
              7.10 Brand
            </span>
          </Link>
          <button type="button" onClick={onClose} className="-me-2 grid h-11 w-11 place-items-center" aria-label={t.common.close}>
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-5 py-8" aria-label="Mobile">
          <ul className="space-y-1">
            {primary.map((item, i) => (
              <li
                key={item.href}
                className={open ? "rise" : "opacity-0"}
                style={{ animationDelay: `${0.08 + i * 0.05}s` }}
              >
                <Link href={item.href} onClick={onClose} className="group flex items-center justify-between py-2">
                  <span className="flex items-baseline gap-4">
                    <span className="font-display text-[11px] text-cream/45" dir="ltr">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="display text-[2.4rem]">{item.label}</span>
                  </span>
                  <ArrowUpRight className="flip-rtl h-5 w-5 text-cream/50 transition-colors group-hover:text-cream" />
                </Link>
              </li>
            ))}
          </ul>

          <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-cream/15 pt-8">
            {secondary.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={onClose} className="text-[15px] text-cream/80 hover:text-cream">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center justify-between border-t border-cream/15 px-5 py-5">
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
            className="btn btn-outline-cream btn-sm"
            lang={locale === "en" ? "ar" : "en"}
          >
            {t.common.switchLanguage}
          </button>
          <div className="flex items-center gap-2">
            <a href={whatsappLink()} target="_blank" rel="noreferrer" className="grid h-11 w-11 place-items-center" aria-label="WhatsApp">
              <WhatsAppIcon />
            </a>
            <a
              href={`https://instagram.com/${store.instagram}`}
              target="_blank"
              rel="noreferrer"
              className="grid h-11 w-11 place-items-center"
              aria-label="Instagram"
            >
              <InstagramIcon />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
