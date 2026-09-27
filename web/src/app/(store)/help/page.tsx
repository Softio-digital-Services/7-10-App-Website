import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, HelpCircle, Plus, RefreshCcw, Ruler, Truck } from "lucide-react";
import { SectionLabel } from "@/components/brand/section-label";
import { WhatsAppIcon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { SizeGuideContent } from "@/components/size-guide";
import { formatPrice } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { regions, store, whatsappLink } from "@/lib/store-config";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.help.title, description: dict.help.intro };
}

export default async function HelpPage() {
  const { dict: t, locale } = await getI18n();
  const minFee = Math.min(...regions.map((r) => r.fee));
  const vars = {
    days: store.deliveryDays,
    min: formatPrice(minFee),
    free: formatPrice(store.freeDeliveryOver),
  };

  const nav = [
    { id: "delivery", label: t.help.shippingTitle, icon: Truck },
    { id: "payment", label: t.help.paymentTitle, icon: Banknote },
    { id: "exchange", label: t.help.returnsTitle, icon: RefreshCcw },
    { id: "size-guide", label: t.product.sizeGuide, icon: Ruler },
    { id: "faq", label: t.help.faqTitle, icon: HelpCircle },
  ];

  return (
    <>
      <section className="container-x pb-12 pt-10 md:pb-16 md:pt-16">
        <SectionLabel index="—">{t.help.label}</SectionLabel>
        <h1 className="display mt-5 text-6xl md:text-8xl">{t.help.title}</h1>
        <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-charcoal/70">{t.help.intro}</p>
        <nav className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label={t.help.title}>
          {nav.map(({ id, label, icon: Icon }, i) => (
            <a key={id} href={`#${id}`} className="group flex items-center justify-between gap-3 border border-charcoal/15 px-4 py-4 transition-colors hover:border-charcoal hover:bg-charcoal hover:text-cream">
              <span className="flex items-center gap-3 text-[14px]">
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                {label}
              </span>
              <span className="font-display text-[11px] opacity-40" dir="ltr">0{i + 1}</span>
            </a>
          ))}
        </nav>
      </section>

      <div className="container-x space-y-20 pb-24 md:space-y-28 md:pb-32">
        <HelpSection id="delivery" index="01" title={t.help.shippingTitle}>
          <ul className="space-y-3">
            {t.help.shipping.map((line) => (
              <Bullet key={line}>{fmt(line, vars)}</Bullet>
            ))}
          </ul>
          <div className="mt-8 overflow-hidden border border-charcoal/10">
            <table className="w-full text-[14.5px]">
              <thead className="bg-cream-2">
                <tr>
                  <th className="eyebrow px-5 py-3 text-start text-[10.5px] font-normal text-charcoal/60">{t.checkout.region}</th>
                  <th className="eyebrow px-5 py-3 text-end text-[10.5px] font-normal text-charcoal/60">{t.checkout.deliveryFee}</th>
                </tr>
              </thead>
              <tbody>
                {regions.map((r) => (
                  <tr key={r.id} className="border-t border-charcoal/10">
                    <td className="px-5 py-3.5">{r[locale]}</td>
                    <td className="px-5 py-3.5 text-end" dir="ltr">{formatPrice(r.fee)}</td>
                  </tr>
                ))}
                <tr className="border-t border-charcoal/10 bg-olive/10">
                  <td className="px-5 py-3.5 font-medium">{fmt(t.product.freeOver, { free: formatPrice(store.freeDeliveryOver) })}</td>
                  <td className="px-5 py-3.5 text-end font-medium text-olive">{t.common.free}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </HelpSection>

        <HelpSection id="payment" index="02" title={t.help.paymentTitle}>
          <div className="grid gap-3 sm:grid-cols-2">
            {t.help.payment.map((line, i) => {
              const [title, ...rest] = line.split(" — ");
              return (
                <div key={line} className="bg-cream-2 p-6">
                  {i === 0 ? <Banknote className="h-6 w-6" strokeWidth={1.25} /> : <span className="font-display text-[11px] tracking-widest text-charcoal/50" dir="ltr">VISA · MC</span>}
                  <p className="display mt-5 text-2xl">{title}</p>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-charcoal/70">{rest.join(" — ")}</p>
                </div>
              );
            })}
          </div>
        </HelpSection>

        <HelpSection id="exchange" index="03" title={t.help.returnsTitle}>
          <ol className="space-y-4">
            {t.help.returns.map((line, i) => (
              <li key={line} className="flex gap-5">
                <span className="grid h-8 w-8 shrink-0 place-items-center border border-charcoal font-display text-[12px]" dir="ltr">
                  {i + 1}
                </span>
                <p className="pt-1 text-[15.5px] leading-relaxed text-charcoal/80">{fmt(line, { days: store.exchangeDays })}</p>
              </li>
            ))}
          </ol>
        </HelpSection>

        <HelpSection id="size-guide" index="04" title={t.product.sizeGuide}>
          <SizeGuideContent />
        </HelpSection>

        <HelpSection id="faq" index="05" title={t.help.faqTitle}>
          <div className="divide-y divide-charcoal/10 border-y border-charcoal/10">
            {t.help.faq.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-[16px] font-medium md:text-[17px] [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <Plus className="h-5 w-5 shrink-0 transition-transform duration-300 group-open:rotate-45" strokeWidth={1.5} />
                </summary>
                <p className="max-w-2xl pb-6 text-[15px] leading-relaxed text-charcoal/70">{item.a}</p>
              </details>
            ))}
          </div>
        </HelpSection>

        <Reveal className="theme-olive relative overflow-hidden px-6 py-14 text-center md:px-16 md:py-20">
          <p className="display text-5xl md:text-7xl">{t.help.stillNeed}</p>
          <p className="mx-auto mt-4 max-w-md text-[16px] text-cream/80">{t.help.stillNeedBody}</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href={whatsappLink()} target="_blank" rel="noreferrer" className="btn btn-cream">
              <WhatsAppIcon className="h-[18px] w-[18px]" /> {t.help.chat}
            </a>
            <Link href="/contact" className="btn btn-outline-cream">
              {t.common.contact}
            </Link>
          </div>
        </Reveal>
      </div>
    </>
  );
}

function HelpSection({ id, index, title, children }: { id: string; index: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-28 gap-8 border-t border-charcoal pt-10 lg:grid-cols-12 lg:gap-16">
      <div className="lg:col-span-4">
        <span className="font-display text-[12px] text-charcoal/45" dir="ltr">[{index}]</span>
        <h2 className="display mt-3 text-4xl md:text-5xl">{title}</h2>
      </div>
      <div className="lg:col-span-8">{children}</div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-4 text-[15.5px] leading-relaxed text-charcoal/80">
      <span className="mt-[0.6em] h-0 w-0 shrink-0 border-x-[5px] border-t-[8px] border-x-transparent border-t-signal" aria-hidden="true" />
      {children}
    </li>
  );
}
