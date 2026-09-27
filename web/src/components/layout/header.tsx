"use client";

import { Img as Image } from "@/components/img";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowUpRight, Menu, Search, ShoppingBag, User } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { useCart } from "@/components/cart-provider";
import { useI18n } from "@/components/i18n-provider";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { SearchOverlay } from "@/components/layout/search-overlay";
import type { StoreCategory } from "@/lib/catalog";
import { useHydrated } from "@/lib/local-store";

export function Header({ categories }: { categories: StoreCategory[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, locale, setLocale, switching } = useI18n();
  const { count: cartCount, openDrawer, ready: cartReady } = useCart();
  const { data: session } = useSession();
  // The header hydrates inside Suspense after the bag has loaded, so it gates the count on its own hydration.
  const hydrated = useHydrated();
  const ready = hydrated && cartReady;
  const count = ready ? cartCount : 0;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const megaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const route = `${pathname}?${searchParams.toString()}`;
  const [lastRoute, setLastRoute] = useState(route);
  if (route !== lastRoute) {
    setLastRoute(route);
    setMenuOpen(false);
    setSearchOpen(false);
    setMegaOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !isTyping(e.target))) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const overlay = (pathname === "/" || pathname === "/about") && !scrolled && !megaOpen && !searchOpen;
  const isStaff = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const openMega = () => {
    if (megaTimer.current) clearTimeout(megaTimer.current);
    setMegaOpen(true);
  };
  const closeMega = () => {
    if (megaTimer.current) clearTimeout(megaTimer.current);
    megaTimer.current = setTimeout(() => setMegaOpen(false), 120);
  };

  const isShop = pathname.startsWith("/shop") || pathname.startsWith("/products");

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-[background-color,color,border-color,backdrop-filter] duration-500 ${
          overlay
            ? "border-b border-cream/15 bg-transparent text-cream"
            : "border-b border-charcoal/10 bg-cream/90 text-charcoal backdrop-blur-xl"
        }`}
        onMouseLeave={closeMega}
      >
        <div className="container-x grid h-16 grid-cols-[1fr_auto_1fr] items-center md:h-[76px]">
          <div className="flex h-full items-center gap-1">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="-ms-2 grid h-11 w-11 place-items-center lg:hidden"
              aria-label={t.common.menu}
            >
              <Menu className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <nav className="hidden h-full items-center gap-9 lg:flex" aria-label="Primary">
              <NavItem href="/shop" label={t.common.shop} active={isShop} onMouseEnter={openMega} onFocus={openMega} />
              <NavItem href="/shop?sort=new" label={t.common.newIn} active={false} onMouseEnter={closeMega} />
              <NavItem href="/about" label={t.common.about} active={pathname === "/about"} onMouseEnter={closeMega} />
              <NavItem href="/help" label={t.common.help} active={pathname === "/help"} onMouseEnter={closeMega} />
            </nav>
          </div>

          <Link href="/" className="flex items-center gap-3" aria-label="7.10 — Home">
            <LogoMark className="h-7 w-auto md:h-8" tone={overlay ? "silver" : "charcoal"} />
            <span className="hidden font-display text-sm font-semibold uppercase keep-tracking tracking-[0.3em] xs:inline" dir="ltr">
              7.10 Brand
            </span>
          </Link>

          <div className="flex items-center justify-end gap-0.5 md:gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="grid h-11 w-11 place-items-center"
              aria-label={t.common.search}
            >
              <Search className="h-[19px] w-[19px]" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={() => setLocale(locale === "en" ? "ar" : "en")}
              disabled={switching}
              className="hidden h-11 items-center px-2 text-[13px] font-medium md:flex disabled:opacity-50"
              lang={locale === "en" ? "ar" : "en"}
            >
              {t.common.switchLanguage}
            </button>
            <Link
              href={session?.user ? (isStaff ? "/admin" : "/orders") : "/login"}
              className="hidden h-11 w-11 place-items-center md:grid"
              aria-label={session?.user ? t.common.account : t.common.signIn}
            >
              <User className="h-[19px] w-[19px]" strokeWidth={1.5} />
            </Link>
            <button
              type="button"
              onClick={openDrawer}
              className="relative -me-2 flex h-11 items-center gap-2 ps-2 pe-2"
              aria-label={`${t.common.bag} (${count})`}
            >
              <ShoppingBag className="h-[19px] w-[19px]" strokeWidth={1.5} />
              <span
                key={count}
                className={`rise grid h-5 min-w-5 place-items-center px-1 font-display text-[11px] font-medium ${
                  ready && count > 0 ? "bg-signal text-white" : overlay ? "border border-cream/40" : "border border-charcoal/25"
                }`}
                dir="ltr"
              >
                {ready ? count : 0}
              </span>
            </button>
          </div>
        </div>

        <div
          className={`absolute inset-x-0 top-full hidden overflow-hidden border-b border-charcoal/10 bg-cream text-charcoal transition-[clip-path,opacity] duration-500 lg:block ${
            megaOpen ? "pointer-events-auto opacity-100 [clip-path:inset(0_0_0_0)]" : "pointer-events-none opacity-0 [clip-path:inset(0_0_100%_0)]"
          }`}
          onMouseEnter={openMega}
          onMouseLeave={closeMega}
        >
          <div className="container-x grid grid-cols-12 gap-10 py-10">
            <div className="col-span-4">
              <p className="eyebrow text-charcoal/50">{t.home.categoriesLabel}</p>
              <ul className="mt-5 space-y-1">
                <li>
                  <Link href="/shop" className="group flex items-baseline justify-between py-1.5">
                    <span className="display text-3xl transition-colors group-hover:text-olive">{t.common.shopAll}</span>
                    <ArrowUpRight className="flip-rtl h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                </li>
                {categories.map((c, i) => (
                  <li key={c.slug}>
                    <Link href={`/shop?c=${c.slug}`} className="group flex items-baseline justify-between py-1.5">
                      <span className="flex items-baseline gap-3">
                        <span className="font-display text-[11px] text-charcoal/40" dir="ltr">
                          0{i + 1}
                        </span>
                        <span className="display text-3xl transition-colors group-hover:text-olive">{c.name}</span>
                      </span>
                      <span className="font-display text-xs text-charcoal/40" dir="ltr">
                        ({c.count})
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-span-2 flex flex-col gap-3 pt-9">
              <Link href="/shop?sort=new" className="link-line w-fit text-[15px]">{t.common.newIn}</Link>
              <Link href="/shop?sale=1" className="link-line w-fit text-[15px]">{t.shop.onSale}</Link>
              <Link href="/track" className="link-line w-fit text-[15px]">{t.common.track}</Link>
              <Link href="/help#size-guide" className="link-line w-fit text-[15px]">{t.product.sizeGuide}</Link>
            </div>
            <div className="col-span-6 grid grid-cols-2 gap-4">
              {categories.slice(0, 2).map((c) =>
                c.image ? (
                  <Link key={c.slug} href={`/shop?c=${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden bg-cream-2">
                    <Image src={c.image} alt={c.name} fill sizes="25vw" className="img-zoom object-cover" />
                    <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-charcoal/70 to-transparent p-5 text-cream">
                      <span className="display text-2xl">{c.name}</span>
                      <ArrowUpRight className="flip-rtl h-5 w-5" />
                    </span>
                  </Link>
                ) : null,
              )}
            </div>
          </div>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} categories={categories} isStaff={isStaff} signedIn={!!session?.user} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function NavItem({ href, label, active, onMouseEnter, onFocus }: { href: string; label: string; active: boolean; onMouseEnter?: () => void; onFocus?: () => void }) {
  return (
    <Link
      href={href}
      className="group relative flex h-full items-center eyebrow text-[11.5px]"
      aria-current={active ? "page" : undefined}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
    >
      <span className="link-line" aria-current={active ? "page" : undefined}>
        {label}
      </span>
      {active && <span className="tri-signal absolute bottom-3 start-1/2 -translate-x-1/2 rtl:translate-x-1/2" aria-hidden="true" />}
    </Link>
  );
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}
