import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n";
import { isSoonMode } from "@/lib/store-config";

const PREVIEW_COOKIE = "710_preview";
const STAFF_PAGES = ["/admin", "/manager"];
const STAFF_APIS = ["/api/admin", "/api/manager", "/api/sync"];
/** Reachable while the store is in "soon" mode. */
const SOON_OPEN = ["/soon", "/login", "/api/auth", "/api/subscribe", "/api/otargi", "/api/hub", "/api/whish", "/media", ...STAFF_PAGES, ...STAFF_APIS];

const startsWithAny = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export const proxy = auth((req) => {
  const { nextUrl } = req;
  const { pathname, searchParams } = nextUrl;
  const role = req.auth?.user?.role;
  const isStaff = role === "ADMIN" || role === "MANAGER";

  const lang = searchParams.get("lang");
  if (lang && isLocale(lang) && !pathname.startsWith("/api")) {
    const url = nextUrl.clone();
    url.searchParams.delete("lang");
    const res = NextResponse.redirect(url);
    res.cookies.set(LOCALE_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  }

  if (startsWithAny(pathname, STAFF_APIS)) {
    if (!req.auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  } else if (startsWithAny(pathname, STAFF_PAGES)) {
    if (!req.auth?.user) {
      const url = new URL("/login", nextUrl);
      url.searchParams.set("callbackUrl", pathname + nextUrl.search);
      return NextResponse.redirect(url);
    }
    if (!isStaff) return NextResponse.redirect(new URL("/", nextUrl));
  }

  const previewKey = process.env.STORE_PREVIEW_KEY;
  if (pathname === "/soon" && previewKey && searchParams.get("preview") === previewKey) {
    const res = NextResponse.redirect(new URL("/", nextUrl));
    res.cookies.set(PREVIEW_COOKIE, previewKey, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
    return res;
  }

  const soon = isSoonMode();
  const previewing = !!previewKey && req.cookies.get(PREVIEW_COOKIE)?.value === previewKey;

  if (soon && !isStaff && !previewing && !startsWithAny(pathname, SOON_OPEN)) {
    if (pathname.startsWith("/api")) return NextResponse.json({ error: "coming_soon" }, { status: 503 });
    return NextResponse.redirect(new URL("/soon", nextUrl));
  }

  if (!soon && pathname === "/soon" && !isStaff && !searchParams.has("preview")) return NextResponse.redirect(new URL("/", nextUrl));

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/|brand/|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|woff2?)$).*)"],
};
