import { en, type Dict } from "./en";
import { ar } from "./ar";

export type Locale = "en" | "ar";
export type { Dict };

export const locales: Locale[] = ["en", "ar"];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "NEXT_LOCALE";

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

export function categoryLabel(dict: Dict, slug: string, name: string) {
  return dict.categories[slug] ?? name;
}
