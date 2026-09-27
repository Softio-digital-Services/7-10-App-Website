import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Brackets } from "@/components/brand/brackets";
import { WhatsAppIcon } from "@/components/icons";
import { Img } from "@/components/img";
import { CopyButton } from "@/components/order/copy-button";
import { OrderTimeline } from "@/components/order/order-timeline";
import { PayWhishButton } from "@/components/order/pay-whish-button";
import { formatDate, formatPrice } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { getOrderForViewer, normalizeOrderNumber } from "@/lib/orders";
import { regions, store, whatsappLink } from "@/lib/store-config";
import { isWhishMethod } from "@/lib/whish";
import { confirmWhishOrder } from "@/lib/whish-settle";

type Params = Promise<{ number: string }>;
type Search = Promise<{ pay?: string }>;

function placedWithin(date: Date, hours: number) {
  return Date.now() - date.getTime() < hours * 3_600_000;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { number } = await params;
  const { dict } = await getI18n();
  return { title: `${dict.order.label} — ${normalizeOrderNumber(number)}`, robots: { index: false } };
}

export default async function OrderPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { number } = await params;
  const { pay } = await searchParams;
  const { dict: t, locale } = await getI18n();
  const orderNumber = normalizeOrderNumber(decodeURIComponent(number));
  let order = await getOrderForViewer(orderNumber);

  if (!order) {
    return (
      <div className="container-x py-20 md:py-28">
        <div className="relative mx-auto max-w-xl border border-charcoal/15 px-6 py-14 text-center">
          <Brackets size="sm" inset="-1px" className="text-charcoal/60" />
          <p className="eyebrow text-charcoal/55">{t.order.number}</p>
          <p className="mt-2 font-display text-3xl tracking-wider" dir="ltr">{orderNumber}</p>
          <p className="mx-auto mt-6 max-w-sm text-charcoal/70">{t.order.notFound}</p>
          <Link href={`/track?o=${encodeURIComponent(orderNumber)}`} className="btn btn-primary mt-8">
            <Search className="h-4 w-4" /> {t.order.track}
          </Link>
        </div>
      </div>
    );
  }

  if (isWhishMethod(order.paymentMethod) && order.paymentStatus !== "PAID") {
    const paymentStatus = await confirmWhishOrder(order);
    if (paymentStatus !== order.paymentStatus) order = { ...order, paymentStatus: paymentStatus as typeof order.paymentStatus };
  }

  const firstName = order.customerName.split(" ")[0];
  const region = regions.find((r) => r.id === order.region);
  const online = isWhishMethod(order.paymentMethod);
  const unpaid = online && order.paymentStatus !== "PAID" && order.status !== "CANCELLED";
  const suffix = region ? `, ${order.city}, ${region.en}` : null;
  const address =
    suffix && order.shippingAddress.endsWith(suffix)
      ? [order.shippingAddress.slice(0, -suffix.length), order.city, region![locale]].join(", ")
      : order.shippingAddress;
  const isNew = placedWithin(order.createdAt, 6);

  return (
    <>
      <section className="theme-olive relative overflow-hidden">
        <span aria-hidden="true" className="text-outline pointer-events-none absolute -bottom-[0.2em] end-0 select-none font-display text-[38vw] font-semibold leading-none md:text-[22vw]" dir="ltr">
          7.10
        </span>
        <div className="container-x relative py-16 md:py-24">
          <svg viewBox="0 0 52 52" className="h-16 w-16 md:h-20 md:w-20" aria-hidden="true">
            <circle cx="26" cy="26" r="25" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
            <path
              d="M15 27 l7 7 l15 -16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="square"
              strokeDasharray="48"
              className={isNew ? "[animation:check-draw_.8s_.3s_var(--ease-out-expo)_both]" : ""}
            />
          </svg>
          <p className="rise eyebrow mt-8 flex items-center gap-3 text-cream/70">
            <span className="dot-signal pulse-signal" /> {t.order.label}
          </p>
          <h1 className="rise display mt-5 max-w-4xl text-5xl md:text-8xl" style={{ animationDelay: "0.1s" }}>
            {fmt(t.order.thanks, { name: firstName })}
          </h1>
          <p className="rise mt-6 max-w-xl text-[17px] text-cream/80" style={{ animationDelay: "0.2s" }}>
            {pay === "ok" && order.paymentStatus === "PAID"
              ? t.order.payOk
              : pay === "failed" || order.paymentStatus === "FAILED"
                ? t.order.payFailed
                : unpaid
                  ? t.order.waitingPay
                  : t.order.body}
          </p>

          <div className="rise mt-10 inline-flex flex-wrap items-center gap-x-6 gap-y-3 border border-cream/25 px-6 py-5" style={{ animationDelay: "0.3s" }}>
            <div>
              <p className="eyebrow text-[10px] text-cream/60">{t.order.number}</p>
              <p className="mt-1 font-display text-3xl tracking-[0.12em] md:text-4xl" dir="ltr">{order.orderNumber}</p>
            </div>
            <CopyButton value={order.orderNumber} label={t.order.copy} doneLabel={t.order.copied} className="border border-cream/30 px-3 py-2 hover:bg-cream hover:text-charcoal" />
            <p className="w-full text-[13px] text-cream/60">{t.order.saveNumber}</p>
          </div>
        </div>
      </section>

      <div className="container-x grid gap-14 py-16 md:py-24 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7">
          <p className="eyebrow text-charcoal/55">{t.order.status}</p>
          <div className="mt-6">
            <OrderTimeline status={order.status} labels={t.track.statuses} />
          </div>

          <h2 className="display mt-16 text-3xl md:text-4xl">{t.order.next}</h2>
          <ol className="mt-8 space-y-6">
            {[t.order.step1, t.order.step2, fmt(online ? t.order.step3Whish : t.order.step3, { days: store.deliveryDays })].map((step, i) => (
              <li key={i} className="flex gap-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center border border-charcoal font-display text-[13px]" dir="ltr">
                  0{i + 1}
                </span>
                <p className="pt-1.5 text-[15.5px] leading-relaxed text-charcoal/80">{step}</p>
              </li>
            ))}
          </ol>

          {unpaid ? <PayWhishButton orderNumber={order.orderNumber} /> : null}

          <div className="mt-12 flex flex-wrap gap-3">
            <Link href={`/track?o=${encodeURIComponent(order.orderNumber)}`} className="btn btn-primary">
              <Search className="h-4 w-4" /> {t.order.track}
            </Link>
            <Link href="/shop" className="btn btn-outline">
              {t.order.keepShopping} <ArrowRight className="flip-rtl h-4 w-4" />
            </Link>
          </div>
          <a
            href={whatsappLink(fmt(t.order.whatsappMessage, { number: order.orderNumber }))}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-3 text-[14px] text-charcoal/70 hover:text-charcoal"
          >
            <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
            {t.order.whatsapp}
          </a>
        </div>

        <aside className="lg:col-span-5">
          <div className="bg-cream-2 p-6 md:p-8">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-charcoal/60">{t.order.items}</p>
              <p className="text-[12.5px] text-charcoal/50">{fmt(t.track.placedOn, { date: formatDate(order.createdAt, locale) })}</p>
            </div>
            <ul className="mt-5 divide-y divide-charcoal/10">
              {order.items.map((item) => {
                const product = item.variant.product;
                const name = (locale === "ar" && product.nameAr) || product.name;
                return (
                  <li key={item.id} className="flex gap-4 py-4 first:pt-0">
                    <Link href={`/products/${product.slug}`} className="card-img relative h-20 w-16 shrink-0">
                      {product.imageUrl && <Img src={product.imageUrl} alt={name} fill sizes="64px" className="object-cover" />}
                    </Link>
                    <div className="flex min-w-0 flex-1 justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14.5px] font-medium">{name}</p>
                        <p className="mt-0.5 text-[13px] text-charcoal/55">
                          {t.bag.size}: <span dir="ltr">{item.variant.size}</span> · ×{item.quantity}
                        </p>
                      </div>
                      <p className="shrink-0 text-[14.5px]" dir="ltr">{formatPrice(item.price * item.quantity)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-4 space-y-2.5 border-t border-charcoal/10 pt-5 text-[14.5px]">
              <div className="flex justify-between">
                <dt className="text-charcoal/70">{t.order.subtotal}</dt>
                <dd dir="ltr">{formatPrice(order.subtotal || order.total - order.deliveryFee)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-charcoal/70">{t.order.delivery}</dt>
                <dd dir="ltr" className={order.deliveryFee === 0 ? "text-olive" : ""}>{order.deliveryFee === 0 ? t.common.free : formatPrice(order.deliveryFee)}</dd>
              </div>
            </dl>
            <div className="mt-5 flex items-end justify-between border-t border-charcoal pt-5">
              <span className="eyebrow">{t.order.total}</span>
              <span className="font-display text-3xl font-medium" dir="ltr">{formatPrice(order.total)}</span>
            </div>

            <div className="mt-8 grid gap-6 border-t border-charcoal/10 pt-6 text-[14px] sm:grid-cols-2">
              <div>
                <p className="eyebrow text-[10px] text-charcoal/55">{t.order.deliverTo}</p>
                <p className="mt-2 font-medium">{order.customerName}</p>
                <p className="text-charcoal/70" dir="ltr">{order.customerPhone}</p>
                <p className="mt-1 text-charcoal/70">{address}</p>
              </div>
              <div>
                <p className="eyebrow text-[10px] text-charcoal/55">{t.order.payment}</p>
                <p className="mt-2">{online ? t.order.whish : t.order.cod}</p>
                {order.paymentStatus === "PAID" && online ? (
                  <p className="mt-1 text-[13px] text-olive">{t.order.payOk}</p>
                ) : unpaid ? (
                  <p className="mt-1 text-[13px] text-charcoal/55">{t.order.waitingPay}</p>
                ) : null}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
