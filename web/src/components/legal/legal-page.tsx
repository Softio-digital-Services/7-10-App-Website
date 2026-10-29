import { SectionLabel } from "@/components/brand/section-label";
import { formatPrice } from "@/lib/format";
import { fmt, type Dict, type Locale } from "@/lib/i18n";
import { store } from "@/lib/store-config";

/** Date the policy text was last changed; update it whenever en.ts / ar.ts legal copy changes. */
const UPDATED = "2026-10-30";

type Doc = Dict["legal"]["privacy"];

export function LegalPage({ doc, t, locale }: { doc: Doc; t: Dict; locale: Locale }) {
  const vars = {
    free: formatPrice(store.freeDeliveryOver),
    delivery: store.deliveryDays,
    days: store.exchangeDays,
    email: store.email,
  };
  const updated = new Intl.DateTimeFormat(locale === "ar" ? "ar-LB-u-nu-latn" : "en-GB", { dateStyle: "long" }).format(new Date(UPDATED));

  return (
    <>
      <section className="container-x pb-10 pt-10 md:pb-14 md:pt-16">
        <SectionLabel index="—">{fmt(t.legal.updated, { date: updated })}</SectionLabel>
        <h1 className="display mt-5 text-5xl md:text-7xl">{doc.title}</h1>
        <p className="mt-5 max-w-2xl text-[16.5px] leading-relaxed text-charcoal/75">{doc.intro}</p>
      </section>
      <div className="container-x space-y-12 pb-24">
        {doc.sections.map((section, i) => (
          <section key={section.title} className="grid gap-6 border-t border-charcoal pt-8 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-4">
              <span className="font-display text-[12px] text-charcoal/65" dir="ltr">[{String(i + 1).padStart(2, "0")}]</span>
              <h2 className="display mt-3 text-3xl md:text-4xl">{section.title}</h2>
            </div>
            <div className="space-y-4 lg:col-span-8">
              {section.body.map((line) => (
                <p key={line} className="max-w-2xl text-[15.5px] leading-relaxed text-charcoal/80">{fmt(line, vars)}</p>
              ))}
            </div>
          </section>
        ))}
        <p className="border-t border-charcoal pt-8 text-[15px] text-charcoal/75">
          {fmt(t.legal.contactLine, vars)}
        </p>
      </div>
    </>
  );
}
