import Link from "next/link";
import { Banknote, CreditCard } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { LangSwitch } from "@/components/lang-switch";
import { NewsletterForm } from "@/components/newsletter-form";
import { getI18n } from "@/lib/i18n/server";
import type { StoreCategory } from "@/lib/catalog";
import { store, whatsappLink } from "@/lib/store-config";

export async function Footer({ categories }: { categories: StoreCategory[] }) {
  const { dict: t } = await getI18n();

  const columns = [
    {
      title: t.footer.shop,
      links: [
        { href: "/shop", label: t.common.shopAll },
        { href: "/shop?sort=new", label: t.common.newIn },
        ...categories.slice(0, 4).map((c) => ({ href: `/shop?c=${c.slug}`, label: c.name })),
      ],
    },
    {
      title: t.footer.support,
      links: [
        { href: "/track", label: t.common.track },
        { href: "/help#delivery", label: t.help.shippingTitle },
        { href: "/help#exchange", label: t.help.returnsTitle },
        { href: "/help#size-guide", label: t.product.sizeGuide },
        { href: "/help#faq", label: t.help.faqTitle },
      ],
    },
    {
      title: t.footer.brand,
      links: [
        { href: "/about", label: t.common.about },
        { href: "/contact", label: t.common.contact },
        { href: "/login", label: t.common.account },
      ],
    },
  ];

  return (
    <footer className="theme-olive relative overflow-hidden">
      <div className="container-x relative pt-16 md:pt-24">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-4">
              <LogoMark className="h-12 w-auto" tone="silver" />
              <span className="font-display text-base font-semibold uppercase keep-tracking tracking-[0.3em]" dir="ltr">
                7.10 Brand
              </span>
            </div>
            <p className="mt-6 max-w-sm text-cream/75">{t.footer.tagline}</p>

            <div className="mt-10 max-w-md">
              <p className="eyebrow text-cream/60">{t.footer.newsletter}</p>
              <div className="mt-2">
                <NewsletterForm tone="light" compact />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7">
            {columns.map((col) => (
              <div key={col.title}>
                <p className="eyebrow text-cream/55">{col.title}</p>
                <ul className="mt-5 space-y-3">
                  {col.links.map((link) => (
                    <li key={link.href + link.label}>
                      <Link href={link.href} className="link-line text-[15px] text-cream/85 hover:text-cream">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="col-span-2 sm:col-span-3">
              <p className="eyebrow text-cream/55">{t.footer.follow}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <a
                  href={whatsappLink()}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-11 items-center gap-2 border border-cream/25 px-4 text-[14px] transition-colors hover:border-cream hover:bg-cream hover:text-charcoal"
                >
                  <WhatsAppIcon className="h-4 w-4" /> WhatsApp
                </a>
                <a
                  href={`https://instagram.com/${store.instagram}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-11 items-center gap-2 border border-cream/25 px-4 text-[14px] transition-colors hover:border-cream hover:bg-cream hover:text-charcoal"
                >
                  <InstagramIcon className="h-4 w-4" /> <span dir="ltr">@{store.instagram}</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="text-outline pointer-events-none mt-16 select-none text-center font-display text-[34vw] font-semibold uppercase leading-[0.8] md:mt-10 lg:text-[26vw]"
          dir="ltr"
        >
          7.10
        </div>

        <div className="relative -mt-[6vw] flex flex-col gap-5 border-t border-cream/15 py-6 text-[12px] text-cream/65 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="eyebrow">{t.footer.rights}</span>
            <span className="flex items-center gap-2 font-display keep-tracking tracking-[0.3em]" dir="ltr">
              <span className="dot-signal" /> 07.10.2026
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2">
              <Banknote className="h-4 w-4" strokeWidth={1.5} />
              <CreditCard className="h-4 w-4" strokeWidth={1.5} />
              {t.footer.payments}
            </span>
            <LangSwitch />
          </div>
        </div>
      </div>
    </footer>
  );
}
