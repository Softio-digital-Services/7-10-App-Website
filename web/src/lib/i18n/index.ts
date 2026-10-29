import { en, type Dict } from "./en";
import { ar } from "./ar";

export type Locale = "en" | "ar";
export type { Dict };

export const locales: Locale[] = ["en", "ar"];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";
/** Set by the proxy on /ar/... requests, so the Arabic URL always renders Arabic whatever the cookie says. */
export const LOCALE_HEADER = "x-710-locale";

export const dictionaries: Record<Locale, Dict> = { en, ar };

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ar";
}

export function dirFor(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}

export function fmt(template: string, vars: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] === undefined ? `{${key}}` : String(vars[key]),
  );
}

/** Public URL of a page in a language: Arabic pages live under /ar so search engines can index both. */
export function localePath(path: string, locale: Locale) {
  if (locale !== "ar") return path;
  return path === "/" ? "/ar" : `/ar${path}`;
}

/** canonical + hreflang links for a page that exists in both languages. */
export function alternatesFor(path: string, locale: Locale) {
  return {
    canonical: localePath(path, locale),
    languages: { en: path, ar: localePath(path, "ar"), "x-default": path },
  };
}

export function categoryLabel(dict: Dict, slug: string, name: string) {
  return dict.categories[slug] ?? name;
}
