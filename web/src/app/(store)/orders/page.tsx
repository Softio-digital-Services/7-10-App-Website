import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Check, Heart, Home, LayoutDashboard, MapPin, Package, Ruler, ShoppingBag, User } from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { WhatsAppIcon } from "@/components/icons";
import { Img } from "@/components/img";
import { auth } from "@/lib/auth";
import { formatDate, formatPrice } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { statusFlow } from "@/lib/order-status";
import { orderInclude, rememberedOrders } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { siteFacts } from "@/lib/site-content";
import { whatsappLink } from "@/lib/store-config";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.auth.ordersTitle, robots: { index: false } };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
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

  const initial = (session.user.name ?? session.user.email ?? "?").trim().charAt(0).toUpperCase();
  const a = t.design.account;
  const rawTab = (await searchParams).tab;
  const tab = (["overview", "orders", "addresses", "fit", "wishlist", "details"] as const).find((k) => k === rawTab) ?? "overview";
  const icon = "h-[18px] w-[18px]";
  const tabs = [
    { href: "/orders", key: "overview", label: a.tabs.overview, icon: <Home className={icon} strokeWidth={1.6} /> },
    { href: "/orders?tab=orders", key: "orders", label: a.tabs.orders, icon: <ShoppingBag className={icon} strokeWidth={1.6} /> },
    { href: "/orders?tab=addresses", key: "addresses", label: a.tabs.addresses, icon: <MapPin className={icon} strokeWidth={1.6} /> },
    { href: "/orders?tab=fit", key: "fit", label: a.tabs.fit, icon: <Ruler className={icon} strokeWidth={1.6} /> },
    { href: "/orders?tab=wishlist", key: "wishlist", label: a.tabs.wishlist, icon: <Heart className={icon} strokeWidth={1.6} /> },
    { href: "/orders?tab=details", key: "details", label: a.tabs.details, icon: <User className={icon} strokeWidth={1.6} /> },
    ...(staff ? [{ href: "/admin", key: "admin", label: t.auth.staff, icon: <LayoutDashboard className={icon} strokeWidth={1.6} /> }] : []),
  ].map((x) => ({ ...x, active: x.key === tab }));
  const shown = tab === "overview" ? orders.slice(0, 1) : orders;
  const replyTime = (await siteFacts(locale))("reply_time", "[Reply time]");

  return (
    <>
      <section className="bg-stone">
        <div className="container-x flex flex-wrap items-center justify-between gap-5 py-6 md:py-9">
          <div className="flex items-center gap-4 md:gap-5">
            <span className="pop grid h-14 w-14 shrink-0 place-items-center rounded-full bg-forest text-[20px] font-bold text-white md:h-16 md:w-16">{initial}</span>
            <div className="min-w-0">
              <h1 className="display text-[2.2rem] leading-none md:text-[3.4rem]">
                <span className="line-mask">
                  <span>{fmt(t.ui.hello, { name: firstName ?? "" })}</span>
                </span>
              </h1>
              <p className="mt-1.5 truncate text-[14px] text-charcoal/75">
                <bdi dir="ltr">{session.user.email}</bdi>
              </p>
            </div>
          </div>
          <SignOutButton label={t.auth.signOut} className="btn btn-outline btn-sm hidden md:inline-flex" />
        </div>
      </section>

      <section className="container-x pb-16 pt-6 md:pb-28 md:pt-9">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <aside className="lg:col-span-3">
            <nav className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-1 lg:px-0" aria-label={t.ui.myAccount}>
              {tabs.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={tab.active ? "page" : undefined}
                  className={`flex shrink-0 items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-medium transition-colors lg:rounded-lg lg:py-3 ${
                    tab.active ? "bg-forest text-white" : "bg-stone hover:bg-sand lg:bg-transparent lg:hover:bg-stone"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </Link>
              ))}
            </nav>
            <div className="mt-5 hidden rounded-lg bg-forest p-5 text-cream lg:block">
              <p className="text-[15px] font-bold text-white">{t.ui.needHelp}</p>
              <p className="mt-1 text-[14px] text-cream/85">{fmt(a.helpBody, { time: replyTime })}</p>
            </div>
          </aside>

          <div className="lg:col-span-9">
            <div className="flex items-end justify-between gap-4">
              <h2 className="display text-[2.4rem] md:text-[3.2rem]">{tabs.find((x) => x.active)?.label}</h2>
              {orders.length > 0 && <p className="pb-1 text-[14px] text-charcoal/70">{fmt(t.auth.orderCount, { count: orders.length })}</p>}
            </div>

            {tab === "addresses" || tab === "fit" || tab === "wishlist" || tab === "details" ? (
              <div className="mt-6 flex flex-col items-start gap-4 rounded-lg bg-stone p-7 md:p-10">
                <span className="rounded-full bg-white px-3 py-1 text-[12px] font-bold">{a.soon}</span>
                <p className="max-w-lg text-[16px] leading-relaxed">
                  {tab === "addresses" ? a.addressEmpty : tab === "fit" ? a.fitEmpty : tab === "wishlist" ? a.wishlistEmpty : a.details}
                </p>
                {tab === "details" && (
                  <dl className="grid gap-2 text-[15px]">
                    <div><dt className="inline font-bold">{t.auth.name}: </dt><dd className="inline">{session.user.name ?? "—"}</dd></div>
                    <div><dt className="inline font-bold">{t.auth.email}: </dt><dd className="inline"><bdi dir="ltr">{session.user.email}</bdi></dd></div>
                  </dl>
                )}
                <a href={whatsappLink()} target="_blank" rel="noreferrer" className="btn btn-dark btn-sm">
                  <WhatsAppIcon className="h-4 w-4" /> {t.ui.askWhatsApp}
                </a>
              </div>
            ) : orders.length === 0 ? (
              <div className="mt-6 flex flex-col items-start rounded-lg border border-charcoal/15 p-7 md:p-10">
                <Package className="h-10 w-10 text-charcoal/40" strokeWidth={1} />
                <p className="display mt-5 text-3xl">{t.auth.ordersEmpty}</p>
                <p className="mt-2 max-w-sm text-[15px] text-charcoal/70">{t.auth.ordersEmptyBody}</p>
                <Link href="/shop" className="btn btn-primary mt-7">
                  {t.common.shopAll} <ArrowRight className="flip-rtl h-4 w-4" />
                </Link>
              </div>
            ) : (
              <ul className="mt-6 space-y-4">
                {shown.map((order, idx) => {
                  const cancelled = order.status === "CANCELLED";
                  const step = Math.max(0, statusFlow.indexOf(order.status as (typeof statusFlow)[number]));
                  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
                  return (
                    <li key={order.id} className="rounded-lg border border-charcoal/15 p-5 md:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          {idx === 0 && <p className="eyebrow text-[10px] text-signal">{t.ui.yourOrder}</p>}
                          <p className="mt-1 text-[18px] font-bold">
                            <bdi dir="ltr">{order.orderNumber}</bdi>
                          </p>
                          <p className="mt-1 text-[13.5px] text-charcoal/70">
                            {formatDate(order.createdAt, locale)} · {fmt(t.auth.itemCount, { count: units })} · <bdi dir="ltr">{formatPrice(order.total)}</bdi>
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${
                            cancelled ? "bg-signal/10 text-signal" : "bg-forest text-white"
                          }`}
                        >
                          {t.track.statuses[order.status] ?? order.status}
                        </span>
                      </div>

                      {!cancelled && (
                        <ol className="mt-6 grid grid-cols-5" aria-hidden="true">
                          {statusFlow.map((st, i) => {
                            const done = i <= step;
                            return (
                              <li key={st} className="relative flex flex-col items-start">
                                <span className="flex w-full items-center">
                                  <span
                                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
                                      done ? "bg-charcoal text-white" : "border-2 border-charcoal/25 bg-white"
                                    }`}
                                  >
                                    {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                                  </span>
                                  {i < statusFlow.length - 1 && <span className={`h-0.5 flex-1 ${i < step ? "bg-charcoal" : "bg-charcoal/15"}`} />}
                                </span>
                                <span className={`mt-2 pe-2 text-[11.5px] leading-tight md:text-[12.5px] ${i === step ? "font-bold" : done ? "" : "text-charcoal/55"}`}>
                                  {t.track.statuses[st] ?? st}
                                </span>
                              </li>
                            );
                          })}
                        </ol>
                      )}

                      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex -space-x-3 rtl:space-x-reverse">
                          {order.items.slice(0, 4).map((item) => {
                            const product = item.variant.product;
                            return (
                              <span key={item.id} className="card-img relative h-14 w-12 border-2 border-white">
                                {product.imageUrl && (
                                  <Img src={product.imageUrl} alt={(locale === "ar" && product.nameAr) || product.name} fill sizes="48px" className="object-cover" />
                                )}
                              </span>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            href={whatsappLink(`${t.ui.askWhatsApp}: ${order.orderNumber}`)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-dark btn-sm"
                          >
                            <WhatsAppIcon className="h-4 w-4" /> {t.ui.askWhatsApp}
                          </a>
                          <Link href={`/order/${order.orderNumber}`} className="btn btn-outline btn-sm">
                            {t.auth.view}
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {tab === "overview" && orders.length > 1 && (
              <Link href="/orders?tab=orders" className="btn btn-outline btn-sm mt-4">
                {a.all}
              </Link>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-stone p-5 md:p-6">
              <div>
                <p className="heading-cond text-[19px]">{t.auth.guestOrders}</p>
                <p className="mt-1 text-[14px] text-charcoal/75">{t.auth.guestOrdersBody}</p>
              </div>
              <Link href="/track" className="btn btn-outline btn-sm">
                {t.common.track}
              </Link>
            </div>

            <SignOutButton label={t.auth.signOut} className="btn btn-outline mt-6 w-full md:hidden" />
          </div>
        </div>
      </section>
    </>
  );
}
