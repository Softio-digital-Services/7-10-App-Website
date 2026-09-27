"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, LoaderCircle, Search } from "lucide-react";
import { Brackets } from "@/components/brand/brackets";
import { SectionLabel } from "@/components/brand/section-label";
import { useI18n } from "@/components/i18n-provider";
import { WhatsAppIcon } from "@/components/icons";
import { Img } from "@/components/img";
import { OrderTimeline } from "@/components/order/order-timeline";
import { formatDate, formatPrice } from "@/lib/format";
import { regions, store, whatsappLink } from "@/lib/store-config";

type TrackedOrder = {
  orderNumber: string;
  status: string;
  paymentMethod: "COD" | "CARD" | "WHISH";
  createdAt: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  city: string;
  region: string;
  items: { id: string; name: string; nameAr: string | null; slug: string; image: string; size: string; quantity: number; price: number }[];
};

export function TrackView({ initialOrder }: { initialOrder: string }) {
  const { t, f, locale } = useI18n();
  const [orderNumber, setOrderNumber] = useState(initialOrder);
  const [phone, setPhone] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error" | "rate">("idle");
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim() || !phone.trim()) {
      setState("error");
      return;
    }
    setState("loading");
    const res = await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber, phone }),
    }).catch(() => null);
    if (res?.ok) {
      setOrder(await res.json());
      setState("idle");
    } else {
      setOrder(null);
      setState(res?.status === 429 ? "rate" : "error");
    }
  };

  const region = order ? regions.find((r) => r.id === order.region) : null;

  return (
    <div className="container-x pb-24 pt-10 md:pb-32 md:pt-16">
      <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <SectionLabel index="—">{t.track.label}</SectionLabel>
          <h1 className="display mt-5 text-5xl md:text-7xl">{t.track.title}</h1>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-charcoal/70">{t.track.intro}</p>

          <form onSubmit={submit} noValidate className="mt-10 space-y-5">
            <div>
              <label htmlFor="tr-order" className="field-label">{t.track.orderNumber}</label>
              <input
                id="tr-order"
                className="field font-display text-[17px] uppercase tracking-[0.12em]"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
                placeholder={t.track.orderNumberPlaceholder}
                autoComplete="off"
                dir="ltr"
              />
            </div>
            <div>
              <label htmlFor="tr-phone" className="field-label">{t.track.phone}</label>
              <div className="flex" dir="ltr">
                <span className="grid shrink-0 place-items-center border border-e-0 border-charcoal/20 bg-cream-2 px-4 font-display text-[14px] tracking-wider">
                  {store.phonePrefix}
                </span>
                <input
                  id="tr-phone"
                  className="field"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d\s+-]/g, ""))}
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="70 123 456"
                />
              </div>
            </div>
            {(state === "error" || state === "rate") && (
              <p role="alert" className="flex items-start gap-3 border border-signal/40 bg-signal/5 px-4 py-3 text-[14px]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
                {state === "rate" ? t.common.somethingWrong : t.track.notFound}
              </p>
            )}
            <button type="submit" disabled={state === "loading"} className="btn btn-primary w-full">
              {state === "loading" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {t.track.cta}
            </button>
          </form>

          <a href={whatsappLink()} target="_blank" rel="noreferrer" className="mt-8 inline-flex items-center gap-3 text-[14px] text-charcoal/70 hover:text-charcoal">
            <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
            {t.help.chat}
          </a>
        </div>

        <div className="lg:col-span-7">
          {order ? (
            <div className="[animation:fade-in_.5s_ease_both]">
              <div className="bg-cream-2 p-6 md:p-10">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="eyebrow text-[10px] text-charcoal/55">{t.order.number}</p>
                    <p className="mt-1 font-display text-3xl tracking-[0.12em] md:text-4xl" dir="ltr">{order.orderNumber}</p>
                  </div>
                  <p className="text-[13px] text-charcoal/60">{f(t.track.placedOn, { date: formatDate(order.createdAt, locale) })}</p>
                </div>
                <div className="mt-10">
                  <OrderTimeline status={order.status} labels={t.track.statuses} />
                </div>
                {order.status === "CANCELLED" && <p className="mt-8 border-s-2 border-signal ps-4 text-[14px] text-charcoal/75">{t.track.cancelled}</p>}
              </div>

              <ul className="mt-6 divide-y divide-charcoal/10 border-y border-charcoal/10">
                {order.items.map((item) => {
                  const name = (locale === "ar" && item.nameAr) || item.name;
                  return (
                    <li key={item.id} className="flex gap-4 py-4">
                      <Link href={`/products/${item.slug}`} className="card-img relative h-20 w-16 shrink-0">
                        {item.image && <Img src={item.image} alt={name} fill sizes="64px" className="object-cover" />}
                      </Link>
                      <div className="flex min-w-0 flex-1 justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[14.5px] font-medium">{name}</p>
                          <p className="mt-0.5 text-[13px] text-charcoal/55">
                            {t.bag.size}: <span dir="ltr">{item.size}</span> · ×{item.quantity}
                          </p>
                        </div>
                        <p className="shrink-0 text-[14.5px]" dir="ltr">{formatPrice(item.price * item.quantity)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                <div className="text-[14px] text-charcoal/70">
                  <p>{order.paymentMethod === "COD" ? t.order.cod : t.order.whish}</p>
                  <p>{[order.city, region?.[locale]].filter(Boolean).join(", ")}</p>
                </div>
                <div className="text-end">
                  <p className="eyebrow text-[10px] text-charcoal/55">{t.order.total}</p>
                  <p className="font-display text-3xl" dir="ltr">{formatPrice(order.total)}</p>
                </div>
              </div>
              <a
                href={whatsappLink(f(t.order.whatsappMessage, { number: order.orderNumber }))}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline mt-8 w-full"
              >
                <WhatsAppIcon className="h-[18px] w-[18px]" /> {t.order.whatsapp}
              </a>
            </div>
          ) : (
            <div className="relative grid min-h-[420px] place-items-center border border-dashed border-charcoal/20 p-10 text-center">
              <Brackets size="md" inset="-1px" className="text-charcoal/50" />
              <div>
                <p className="font-display text-[11px] uppercase tracking-[0.35em] text-charcoal/45" dir="ltr">
                  710-XXXXXX
                </p>
                <div className="mx-auto mt-8 max-w-sm opacity-60">
                  <OrderTimeline status="PENDING" labels={t.track.statuses} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
