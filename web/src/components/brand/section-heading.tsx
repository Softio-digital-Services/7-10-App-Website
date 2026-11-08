import type { Locale } from "@/lib/i18n";

type SectionHeadingProps = {
  title: string;
  /** The same heading in the other language, shown smaller on the far side. */
  alt?: string;
  locale: Locale;
  label?: React.ReactNode;
  /** Extra content next to the alt heading, e.g. a "Shop all" link. */
  aside?: React.ReactNode;
  tone?: "dark" | "light";
  className?: string;
  as?: "h1" | "h2";
};

/** Big block heading with the other-language title opposite it, as in the trail campaign layout. */
export function SectionHeading({ title, alt, locale, label, aside, tone = "dark", className = "", as: Tag = "h2" }: SectionHeadingProps) {
  const altLocale = locale === "ar" ? "en" : "ar";
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-8 gap-y-3 ${className}`}>
      <div className="min-w-0">
        {label}
        <Tag className={`display text-[2.6rem] sm:text-5xl md:text-[3.6rem] ${label ? "mt-3" : ""} ${tone === "light" ? "text-white" : ""}`}>{title}</Tag>
      </div>
      {(alt || aside) && (
        <div className="flex items-center gap-6 pb-1.5">
          {alt && (
            <p
              lang={altLocale}
              dir={altLocale === "ar" ? "rtl" : "ltr"}
              aria-hidden="true"
              className={`hidden leading-none sm:block ${
                altLocale === "ar" ? "font-[Changa] text-2xl font-bold md:text-[1.9rem]" : "display text-2xl"
              } ${tone === "light" ? "text-cream/80" : ""}`}
            >
              {alt}
            </p>
          )}
          {aside}
        </div>
      )}
    </div>
  );
}
