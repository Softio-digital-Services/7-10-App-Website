import type { Metadata } from "next";
import { ArrowUpRight, Clock, Mail } from "lucide-react";
import { SectionLabel } from "@/components/brand/section-label";
import { ContactForm } from "@/components/contact-form";
import { InstagramIcon, WhatsAppIcon } from "@/components/icons";
import { auth } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { store, whatsappLink } from "@/lib/store-config";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.contact.title, description: dict.contact.intro };
}

export default async function ContactPage() {
  const [{ dict: t }, session] = await Promise.all([getI18n(), auth()]);
  const account = session?.user?.email ? { name: session.user.name ?? "", email: session.user.email } : null;
  const waDisplay = `+${store.whatsapp.slice(0, 3)} ${store.whatsapp.slice(3, 5)} ${store.whatsapp.slice(5)}`;

  return (
    <section className="container-x pb-24 pt-10 md:pb-32 md:pt-16">
      <SectionLabel index="—">{t.contact.label}</SectionLabel>
      <h1 className="display mt-5 text-6xl md:text-8xl">{t.contact.title}</h1>
      <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-charcoal/70">{t.contact.intro}</p>

      <div className="mt-12 grid gap-12 md:mt-16 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <ContactForm account={account} />
        </div>

        <aside className="space-y-3 lg:col-span-5">
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noreferrer"
            className="theme-olive group relative block overflow-hidden p-7 transition-colors hover:bg-olive-deep md:p-8"
          >
            <span className="eyebrow inline-flex items-center gap-2 bg-cream px-2.5 py-1 text-[10px] text-olive">
              <span className="dot-signal pulse-signal" /> {t.contact.fastest}
            </span>
            <div className="mt-8 flex items-end justify-between gap-4">
              <div>
                <p className="flex items-center gap-3 text-[15px] text-cream/80">
                  <WhatsAppIcon className="h-5 w-5" /> {t.contact.whatsapp}
                </p>
                <p className="display mt-2 text-3xl md:text-4xl">
                  <bdi dir="ltr">{waDisplay}</bdi>
                </p>
                <p className="mt-3 text-[14px] text-cream/70">{t.contact.whatsappBody}</p>
              </div>
              <ArrowUpRight className="flip-rtl h-7 w-7 shrink-0 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" strokeWidth={1.25} />
            </div>
          </a>

          <p className="eyebrow pt-6 text-[10.5px] text-charcoal/50">{t.contact.channels}</p>
          <Channel
            href={`https://instagram.com/${store.instagram}`}
            icon={<InstagramIcon className="h-5 w-5" />}
            label={t.contact.instagram}
            value={`@${store.instagram}`}
            body={t.contact.instagramBody}
          />
          <Channel
            href={`mailto:${store.email}`}
            icon={<Mail className="h-5 w-5" strokeWidth={1.5} />}
            label={t.contact.emailUs}
            value={store.email}
            body={t.contact.emailBody}
          />
          <p className="flex items-center gap-2.5 pt-4 text-[13.5px] text-charcoal/60">
            <Clock className="h-4 w-4" strokeWidth={1.5} /> {t.contact.hours}
          </p>
        </aside>
      </div>
    </section>
  );
}

function Channel({ href, icon, label, value, body }: { href: string; icon: React.ReactNode; label: string; value: string; body: string }) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="group flex items-start gap-5 border border-charcoal/15 p-6 transition-colors hover:border-charcoal"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center bg-cream-2">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-charcoal/55">{label}</span>
        <span className="mt-0.5 block truncate text-[16px] font-medium">
          <bdi dir="ltr">{value}</bdi>
        </span>
        <span className="mt-1.5 block text-[13.5px] leading-relaxed text-charcoal/60">{body}</span>
      </span>
      <ArrowUpRight className="flip-rtl mt-1 h-5 w-5 shrink-0 text-charcoal/40 transition-colors group-hover:text-charcoal" strokeWidth={1.5} />
    </a>
  );
}
