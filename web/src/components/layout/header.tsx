"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronLeft, Lock, Moon, Search, ShoppingBag, Sun, User } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useCart } from "@/components/cart-provider";
import { useI18n } from "@/components/i18n-provider";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { SearchOverlay } from "@/components/layout/search-overlay";
import type { StoreCategory } from "@/lib/catalog";
import { useHydrated } from "@/lib/local-store";

/** Path without the /ar language prefix, so page checks work in both languages. */
export function stripLocale(pathname: string) {
  return pathname.replace(/^\/ar(?=\/|$)/, "") || "/";
}

/** Pages that get the compact app-style bar on phones: back, title, bag. */
export function isAppPage(pathname: string) {
  return /^\/(products\/|cart|checkout|login|register|orders|order\/|track)/.test(stripLocale(pathname));
}

export function Header({ categories }: { categories: StoreCategory[] }) {
  const pathname = stripLocale(usePathname());
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const [dropOpen, setDropOpen] = useState(false);
  const dropTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const route = `${pathname}?${searchParams.toString()}`;
  const [lastRoute, setLastRoute] = useState(route);
  if (route !== lastRoute) {
    setLastRoute(route);
    setMenuOpen(false);
    setSearchOpen(false);
    setDropOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
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
      if (e.key === "Escape") setDropOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isStaff = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";
  const accountHref = session?.user ? (isStaff ? "/admin" : "/orders") : "/login";
  const app = isAppPage(pathname);

  const openDrop = () => {
    if (dropTimer.current) clearTimeout(dropTimer.current);
    setDropOpen(true);
  };
  const closeDrop = () => {
    if (dropTimer.current) clearTimeout(dropTimer.current);
    dropTimer.current = setTimeout(() => setDropOpen(false), 140);
  };

  const isShop = pathname.startsWith("/shop") || pathname.startsWith("/products");
  const d = t.design.nav;
  const nav = [
    { href: "/", label: d.home, active: pathname === "/" },
    { href: "/#gallery", label: d.gallery, active: false },
    { href: "/#reviews", label: d.reviews, active: false },
    { href: "/help#size-guide", label: d.sizeGuide, active: false },
    { href: "/about", label: d.about, active: pathname === "/about" },
  ];

  const bagButton = (
    <button type="button" onClick={openDrawer} className="press relative grid h-11 w-11 place-items-center" aria-label={`${t.common.bag} (${count})`}>
      <ShoppingBag className="h-[20px] w-[20px]" strokeWidth={1.6} />
      {ready && count > 0 && (
        <span
          key={count}
          className="pop absolute end-0.5 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-signal px-1 text-[10px] font-bold leading-none text-white"
          dir="ltr"
        >
          {count}
        </span>
      )}
    </button>
  );

  const langButton = (className = "") => (
    <button
      type="button"
      onClick={() => setLocale(locale === "en" ? "ar" : "en")}
      disabled={switching}
      className={`h-11 items-center px-2 text-[15px] font-bold disabled:opacity-50 ${className}`}
      lang={locale === "en" ? "ar" : "en"}
    >
      {locale === "en" ? "عربي" : "English"}
    </button>
  );

  // Compact phone title for app pages.
  const appTitle = pathname.startsWith("/cart")
    ? `${t.ui.cart} · ${count}`
    : pathname.startsWith("/checkout")
      ? t.checkout.title
      : pathname.startsWith("/orders")
        ? t.ui.myAccount
        : null;

  const back = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b bg-gradient-to-b from-white to-[#f4f4f0] text-charcoal transition-shadow duration-300 ${
          scrolled ? "border-charcoal/10 shadow-[0_8px_24px_-16px_rgba(47,58,44,0.45)]" : "border-charcoal/10"
        }`}
        onMouseLeave={closeDrop}
      >
        {/* Phone: compact app bar */}
        {app && (
          <div className="container-x relative grid h-14 grid-cols-[3rem_1fr_3rem] items-center lg:hidden">
            <button type="button" onClick={back} className="press -ms-2 grid h-11 w-11 place-items-center" aria-label={t.common.back}>
              <ChevronLeft className="flip-rtl h-6 w-6" strokeWidth={1.75} />
            </button>
            <div className="flex justify-center">
              {appTitle ? (
                <span className="font-display text-[19px] font-bold uppercase leading-none tracking-[0.04em]">{appTitle}</span>
              ) : (
                <Link href="/" className="flex items-center" aria-label={t.common.homeLink}>
                  <Logo variant="horizontal" className="h-8 w-auto" />
                </Link>
              )}
            </div>
            <div className="-me-2 flex justify-end">
              {pathname.startsWith("/checkout") ? (
                <span className="grid h-11 w-11 place-items-center">
                  <Lock className="h-[18px] w-[18px]" strokeWidth={1.6} />
                </span>
              ) : pathname.startsWith("/cart") ? (
                <Link href="/" className="grid h-11 w-11 place-items-center" aria-label={t.common.homeLink}>
                  <Logo variant="mark" className="h-6 w-auto" />
                </Link>
              ) : (
                bagButton
              )}
            </div>
          </div>
        )}

        {/* Full bar: always on desktop, on phones for browsing pages */}
        <div className={app ? "hidden lg:block" : ""}>
          <div className="container-x flex h-[60px] items-center justify-between gap-4 lg:h-[72px]">
            <div className="flex h-full items-center gap-10">
              <Link href="/" className="flex shrink-0 items-center" aria-label={t.common.homeLink}>
                <Logo variant="horizontal" className="h-9 w-auto md:h-10" />
              </Link>
              <nav className="hidden h-full items-center gap-8 lg:flex" aria-label={t.common.mainNav}>
                <NavItem {...nav[0]} onMouseEnter={closeDrop} />
                <div className="relative flex h-full items-center" onMouseEnter={openDrop} onMouseLeave={closeDrop}>
                  <button
                    type="button"
                    onClick={() => setDropOpen((v) => !v)}
                    onFocus={openDrop}
                    aria-expanded={dropOpen}
                    aria-haspopup="true"
                    className="flex items-center gap-1 font-display text-[16px] font-semibold uppercase leading-none tracking-[0.04em]"
                  >
                    <span className="nav-line" aria-current={isShop ? "page" : undefined}>
                      {t.ui.categories}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${dropOpen ? "rotate-180" : ""}`} strokeWidth={2} />
                  </button>
                  <div
                    className={`absolute start-0 top-[calc(100%-6px)] w-64 rounded-lg border border-charcoal/10 bg-white p-2 shadow-[0_24px_40px_-20px_rgba(47,58,44,0.45)] transition-[opacity,transform] duration-300 ease-[var(--ease-out-expo)] ${
                      dropOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
                    }`}
                  >
                    <DropLink href="/shop?sort=new" label={d.new} meta={locale === "ar" ? "New" : "جديد"} accent />
                    {categories.map((c) => (
                      <DropLink key={c.slug} href={`/shop?c=${c.slug}`} label={c.name} meta={c.altName ?? undefined} />
                    ))}
                    <Link href="/shop" className="mt-1 block border-t border-charcoal/10 px-3 pb-1.5 pt-3 text-[14px] font-semibold underline underline-offset-4 hover:text-signal">
                      {d.seeAll}
                    </Link>
                  </div>
                </div>
                {nav.slice(1).map((n) => (
                  <NavItem key={n.href} {...n} onMouseEnter={closeDrop} />
                ))}
              </nav>
            </div>

            <div className="-me-2 flex items-center gap-0.5 md:gap-1">
              {langButton("flex")}
              <ThemeToggle label={locale === "ar" ? "الوضع الداكن" : "Dark mode"} />
              <button type="button" onClick={() => setSearchOpen(true)} className="press grid h-11 w-11 place-items-center" aria-label={t.common.search}>
                <Search className="h-[19px] w-[19px]" strokeWidth={1.6} />
              </button>
              <Link
                href={accountHref}
                className="press relative hidden h-11 w-11 place-items-center sm:grid"
                aria-label={session?.user ? t.common.account : t.common.signIn}
              >
                <User className="h-[19px] w-[19px]" strokeWidth={1.6} />
                {session?.user && <span className="absolute bottom-1.5 start-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-signal rtl:translate-x-1/2" />}
              </Link>
              {bagButton}
            </div>
          </div>

          {/* Phone: scrolling nav strip */}
          <nav className="no-scrollbar -mt-1 flex gap-6 overflow-x-auto px-4 pb-2.5 lg:hidden" aria-label={t.common.mainNav}>
            <MobileNavLink href="/" label={t.common.home} active={pathname === "/"} />
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap py-1 text-[14px] font-semibold"
            >
              {t.ui.categories} <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {nav.slice(1).map((n) => (
              <MobileNavLink key={n.href} {...n} />
            ))}
            <MobileNavLink href={accountHref} label={session?.user ? t.common.account : t.common.signIn} active={false} />
          </nav>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} categories={categories} isStaff={isStaff} signedIn={!!session?.user} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function NavItem({ href, label, active, onMouseEnter }: { href: string; label: string; active: boolean; onMouseEnter?: () => void }) {
  return (
    <Link
      href={href}
      className="flex h-full items-center font-display text-[16px] font-semibold uppercase leading-none tracking-[0.04em]"
      aria-current={active ? "page" : undefined}
      onMouseEnter={onMouseEnter}
    >
      <span className="nav-line">{label}</span>
    </Link>
  );
}

function DropLink({ href, label, meta, accent }: { href: string; label: string; meta?: string; accent?: boolean }) {
  return (
    <Link href={href} className="group flex min-h-11 items-baseline justify-between gap-6 rounded-lg px-3.5 py-2.5 transition-colors hover:bg-stone">
      <span className={`text-[16px] font-bold transition-transform duration-300 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 ${accent ? "text-signal" : ""}`}>{label}</span>
      {meta && <span className="font-[Changa] text-[14px] font-semibold text-ash">{meta}</span>}
    </Link>
  );
}

/** Light/dark switch. The choice is saved; with none saved the site follows the device. */
function ThemeToggle({ label }: { label: string }) {
  const hydrated = useHydrated();
  const [picked, setDark] = useState<boolean | null>(null);
  // Before hydration the server can't know the theme; afterwards read what the head script set.
  const dark = picked ?? (hydrated ? document.documentElement.dataset.theme === "dark" : null);
  const flip = () => {
    const next = !(document.documentElement.dataset.theme === "dark");
    const root = document.documentElement;
    root.classList.add("theme-anim");
    root.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("710.theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
    window.setTimeout(() => root.classList.remove("theme-anim"), 300);
  };
  return (
    <button type="button" onClick={flip} className="press grid h-11 w-11 place-items-center" aria-label={label} aria-pressed={dark ?? undefined}>
      {dark ? <Sun className="h-[19px] w-[19px]" strokeWidth={1.6} /> : <Moon className="h-[19px] w-[19px]" strokeWidth={1.6} />}
    </button>
  );
}

function MobileNavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 whitespace-nowrap border-b-2 py-1 text-[14px] font-semibold ${active ? "border-charcoal" : "border-transparent"}`}
    >
      {label}
    </Link>
  );
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}
