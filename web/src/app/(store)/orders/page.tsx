import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LayoutDashboard, Package, Search } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SectionLabel } from "@/components/brand/section-label";
import { Img } from "@/components/img";
import { auth } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { statusFlow } from "@/lib/order-status";
import { orderInclude, rememberedOrders } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.auth.ordersTitle, robots: { index: false } };
}

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/orders");

  const [{ dict: t, locale }, remembered] = await Promise.all([getI18n(), rememberedOrders()]);
  const orders = await prisma.order.findMany({
    where: { OR: [{ userId: session.user.id }, ...(remembered.length ? [{ orderNumber: { in: remembered } }] : [])] },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });

  const staff = session.user.role === "ADMIN" || session.user.role === "MANAGER";
  const firstName = (session.user.name ?? "").split(" ")[0] || session.user.email;

  return (
    <section className="container-x pb-24 pt-10 md:pb-32 md:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-6 border-b border-charcoal pb-8">
        <div>
          <SectionLabel index="—">{t.auth.accountLabel}</SectionLabel>
          <h1 className="display mt-5 text-5xl md:text-7xl">{fmt(t.auth.hello, { name: firstName ?? "" })}</h1>
          <p className="mt-3 text-[15px] text-charcoal/60">
            <bdi dir="ltr">{session.user.email}</bdi>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {staff && (
            <Link href="/admin" className="btn btn-outline btn-sm">
              <LayoutDashboard className="h-4 w-4" strokeWidth={1.5} /> {t.auth.staff}
            </Link>
          )}
          <SignOutButton label={t.auth.signOut} className="btn btn-outline btn-sm" />
        </div>
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-8">
          <div className="flex items-baseline justify-between">
            <h2 className="display text-3xl md:text-4xl">{t.auth.ordersTitle}</h2>
            {orders.length > 0 && <p className="text-[13.5px] text-charcoal/55">{fmt(t.auth.orderCount, { count: orders.length })}</p>}
          </div>

          {orders.length === 0 ? (
            <div className="mt-8 flex flex-col items-start border border-dashed border-charcoal/25 p-8 md:p-12">
              <Package className="h-10 w-10 text-charcoal/40" strokeWidth={1} />
              <p className="display mt-6 text-3xl">{t.auth.ordersEmpty}</p>
              <p className="mt-2 max-w-sm text-[15px] text-charcoal/65">{t.auth.ordersEmptyBody}</p>
              <Link href="/shop" className="btn btn-primary mt-8">
                {t.common.shopAll} <ArrowRight className="flip-rtl h-4 w-4" />
              </Link>
            </div>
          ) : (
            <ul className="mt-8 space-y-4">
              {orders.map((order) => {
                const cancelled = order.status === "CANCELLED";
                const step = Math.max(0, statusFlow.indexOf(order.status as (typeof statusFlow)[number]));
                const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
                return (
                  <li key={order.id}>
                    <Link
                      href={`/order/${order.orderNumber}`}
                      className="group block border border-charcoal/15 p-5 transition-colors hover:border-charcoal md:p-7"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="font-display text-xl tracking-[0.1em] md:text-2xl">
                            <bdi dir="ltr">{order.orderNumber}</bdi>
                          </p>
                          <p className="mt-1 text-[13px] text-charcoal/55">
                            {fmt(t.track.placedOn, { date: formatDate(order.createdAt, locale) })} · {fmt(t.auth.itemCount, { count: units })}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1.5 text-[12.5px] ${
                            cancelled ? "bg-signal/10 text-signal" : order.status === "DELIVERED" ? "bg-olive text-cream" : "bg-cream-2"
                          }`}
                        >
                          {!cancelled && order.status !== "DELIVERED" && <span className="dot-signal pulse-signal" />}
                          {t.track.statuses[order.status] ?? order.status}
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-5 gap-1" aria-hidden="true">
                        {statusFlow.map((s, i) => (
                          <span key={s} className={`h-[3px] ${cancelled ? "bg-signal/25" : i <= step ? "bg-charcoal" : "bg-charcoal/10"}`} />
                        ))}
                      </div>

                      <div className="mt-6 flex items-end justify-between gap-4">
                        <div className="flex -space-x-3 rtl:space-x-reverse">
                          {order.items.slice(0, 4).map((item) => {
                            const product = item.variant.product;
                            return (
                              <span key={item.id} className="card-img relative h-16 w-12 border-2 border-cream md:h-20 md:w-16">
                                {product.imageUrl && (
                                  <Img src={product.imageUrl} alt={(locale === "ar" && product.nameAr) || product.name} fill sizes="64px" className="object-cover" />
                                )}
                              </span>
                            );
                          })}
                          {order.items.length > 4 && (
                            <span className="relative grid h-16 w-12 place-items-center border-2 border-cream bg-cream-2 font-display text-[13px] md:h-20 md:w-16" dir="ltr">
                              +{order.items.length - 4}
                            </span>
                          )}
                        </div>
                        <div className="text-end">
                          <p className="font-display text-2xl">
                            <bdi dir="ltr">{formatPrice(order.total)}</bdi>
                          </p>
                          <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-charcoal/60 group-hover:text-charcoal">
                            {t.auth.view} <ArrowRight className="flip-rtl h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="lg:col-span-4">
          <div className="bg-cream-2 p-6 md:p-8 lg:sticky lg:top-[100px]">
            <Search className="h-6 w-6" strokeWidth={1.25} />
            <p className="display mt-5 text-2xl">{t.auth.guestOrders}</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-charcoal/65">{t.auth.guestOrdersBody}</p>
            <Link href="/track" className="btn btn-outline btn-sm mt-6">
              {t.common.track}
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
