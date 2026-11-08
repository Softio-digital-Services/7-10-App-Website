import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { FooterSwitch } from "@/components/layout/footer-switch";
import { NewsletterForm } from "@/components/newsletter-form";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import type { StoreCategory } from "@/lib/catalog";
import { store, whatsappLink } from "@/lib/store-config";

export async function Footer({ categories }: { categories: StoreCategory[] }) {
  const { dict: t } = await getI18n();
  const phone = store.phone || `+${store.whatsapp}`;

  const help = [
    { href: "/help#delivery", label: t.design.footer.delivery },
    { href: "/help#exchange", label: t.design.footer.returns },
    { href: "/help#size-guide", label: t.design.footer.sizeGuide },
    { href: "/track", label: t.common.track },
  ];

  const logo = (
    <Link href="/" className="inline-flex items-center" aria-label={t.common.homeLink}>
      <Logo variant="horizontal" tone="on-dark" className="h-11 w-auto" />
    </Link>
  );

  const waLink = (
    <a href={whatsappLink()} target="_blank" rel="noreferrer" className="hover:text-white hover:underline hover:underline-offset-4">
      WhatsApp <span dir="ltr">{phone}</span>
    </a>
  );

  const full = (
    <footer className="theme-olive">
      <div className="container-x pt-12 md:pt-14">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-6">
            {logo}
            <p className="mt-4 max-w-xs text-[14px] text-cream/90">{t.design.footer.tagline}</p>
            <p className="mt-6 text-[12px] font-bold text-cream">{t.design.footer.newsletter}</p>
            <div className="mt-2 max-w-[380px]">
              <NewsletterForm tone="light" compact />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 md:col-span-6">
            <div>
              <p className="heading-cond text-[15px] text-cream">{t.design.footer.shop}</p>
              <ul className="mt-3 space-y-2 text-[14px] text-cream/85">
                <li>
                  <Link href="/shop" className="hover:text-white hover:underline hover:underline-offset-4">{t.common.shopAll}</Link>
                </li>
                {categories.slice(0, 4).map((c) => (
                  <li key={c.slug}>
                    <Link href={`/shop?c=${c.slug}`} className="hover:text-white hover:underline hover:underline-offset-4">{c.name}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="heading-cond text-[15px] text-cream">{t.design.footer.help}</p>
              <ul className="mt-3 space-y-2 text-[14px] text-cream/85">
                {help.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-white hover:underline hover:underline-offset-4">{l.label}</Link>
                  </li>
                ))}
                <li>{waLink}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-cream/15 py-4 text-[11.5px] text-cream/70 md:mt-12 md:flex-row md:items-center md:justify-between">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {fmt(t.design.footer.rights, { year: new Date().getFullYear() })}
            <Link href="/terms" className="hover:text-white">{t.legal.terms.title}</Link>
            <Link href="/privacy" className="hover:text-white">{t.legal.privacy.title}</Link>
          </span>
          <span>{t.design.footer.payments}</span>
        </div>
      </div>
    </footer>
  );

  const slim = (
    <footer className="theme-olive">
      <div className="container-x flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-6 md:py-7">
        {logo}
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-cream/90 underline underline-offset-4">
          {help.slice(0, 3).map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white">
              {l.label}
            </Link>
          ))}
          {waLink}
        </nav>
        <span className="text-[11.5px] text-cream/70">{fmt(t.design.footer.rights, { year: new Date().getFullYear() })}</span>
      </div>
    </footer>
  );

  return <FooterSwitch full={full} slim={slim} />;
}
