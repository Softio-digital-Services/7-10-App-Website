import { cookies, headers } from "next/headers";
import { defaultLocale, dictionaries, dirFor, isLocale, LOCALE_COOKIE, LOCALE_HEADER, type Locale } from "./index";

export async function getLocale(): Promise<Locale> {
  const forced = (await headers()).get(LOCALE_HEADER);
  if (isLocale(forced)) return forced;
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function getI18n() {
  const locale = await getLocale();
  return { locale, dict: dictionaries[locale], dir: dirFor(locale) } as const;
}
