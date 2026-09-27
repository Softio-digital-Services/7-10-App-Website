import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Brackets } from "@/components/brand/brackets";
import { getCategories } from "@/lib/catalog";
import { getI18n } from "@/lib/i18n/server";

export default async function NotFound() {
  const { dict: t, locale } = await getI18n();
  const categories = await getCategories(locale);

  return (
    <section className="container-x relative flex min-h-[78svh] flex-col items-center justify-center overflow-hidden py-20 text-center">
      <p aria-hidden="true" className="text-outline-dark pointer-events-none select-none font-display text-[42vw] font-semibold leading-[0.8] md:text-[22rem]" dir="ltr">
        4<span className="relative inline-block">
          0
          <span className="absolute left-1/2 top-1/2 h-0 w-0 -translate-x-1/2 -translate-y-1/2 border-x-[0.12em] border-t-[0.2em] border-x-transparent border-t-signal" />
        </span>4
      </p>
      <div className="relative -mt-[8vw] md:-mt-24">
        <h1 className="display text-5xl md:text-7xl">{t.notFound.title}</h1>
        <p className="mx-auto mt-4 max-w-md text-[16px] text-charcoal/65">{t.notFound.body}</p>

        <form action="/shop" className="relative mx-auto mt-10 flex w-full max-w-md items-center border border-charcoal/25 focus-within:border-charcoal">
          <Brackets size="sm" inset="-6px" className="text-charcoal/50" />
          <Search className="ms-4 h-[18px] w-[18px] shrink-0 text-charcoal/50" strokeWidth={1.5} />
          <label htmlFor="nf-q" className="sr-only">{t.notFound.search}</label>
          <input id="nf-q" name="q" placeholder={t.notFound.search} className="h-13 w-full bg-transparent px-3 py-3.5 text-[15px] outline-none placeholder:text-charcoal/40" />
          <button type="submit" className="grid h-full shrink-0 place-items-center bg-charcoal px-4 py-3.5 text-cream" aria-label={t.common.search}>
            <ArrowRight className="flip-rtl h-[18px] w-[18px]" />
          </button>
        </form>

        {categories.length > 0 && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {categories.slice(0, 6).map((c) => (
              <Link key={c.slug} href={`/shop?c=${c.slug}`} className="border border-charcoal/15 px-4 py-2 text-[13.5px] transition-colors hover:border-charcoal hover:bg-charcoal hover:text-cream">
                {c.name}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-primary">
            {t.notFound.cta}
          </Link>
          <Link href="/shop" className="btn btn-outline">
            {t.notFound.shop} <ArrowRight className="flip-rtl h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
