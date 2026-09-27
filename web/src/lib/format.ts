import type { Locale } from "@/lib/i18n";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const usdCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(amount: number) {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? usd.format(rounded) : usdCents.format(rounded);
}

export function formatDate(date: Date | string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-LB-u-nu-latn" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

export function normalizePhone(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("961")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

export function isValidPhone(raw: string) {
  const digits = normalizePhone(raw);
  return digits.length >= 7 && digits.length <= 12;
}

export function phonesMatch(a: string, b: string) {
  const x = normalizePhone(a);
  const y = normalizePhone(b);
  return x.length >= 7 && x === y;
}
