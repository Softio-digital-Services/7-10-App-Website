import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, Heart, Home, LayoutDashboard, MapPin, Package, Ruler, ShoppingBag, User } from "lucide-react";
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
import { discountedPrice } from "@/lib/utils";
import { regions, store, whatsappLink } from "@/lib/store-config";
import { deleteAccount, deleteAddress, makeDefaultAddress, removeFromWishlist, saveAddress, saveDetails, saveFit } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await getI18n();
  return { title: dict.design.account.tabs.overview, robots: { index: false } };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const TABS = ["overview", "orders", "addresses", "fit", "wishlist", "details"] as const;
type Tab = (typeof TABS)[number];

/** Labels used only on this page, in both languages. */
const L = {
  en: {
    saved: "Saved.", error: "Please check the details and try again.", confirmDelete: "Type DELETE to confirm.",
    staffDelete: "Staff accounts are removed by an admin.", label: "Label", labelPh: "Home, Work…", name: "Full name", phone: "Mobile number",
    region: "Governorate", city: "City or town", street: "Street and building", floor: "Floor and apartment", landmark: "Nearest landmark",
    makeDefault: "Make default", default: "Default", edit: "Edit", remove: "Remove", add: "Add an address", save: "Save address",
    noAddress: "No saved addresses yet. Add one and checkout fills it in for you.", height: "Height (cm)", how: "How do you like it to fit?",
    tops: "Tops and jackets", pants: "Pants", hijab: "Sports hijab", saveFit: "Save my fit",
    fitIntro: "We use your fit to pre-select sizes on every product, and to answer faster when you ask us on WhatsApp.",
    noFit: "No fit saved yet.", wishEmpty: "Nothing saved yet. Tap the heart on any product to save it here.", view: "View",
    email: "Email", language: "Language", wa: "WhatsApp updates", waBody: "Order status, new drops and trail days.", saveChanges: "Save changes",
    danger: "Delete my account", dangerBody: "Your account, addresses, fit and wishlist are deleted. Past orders stay with the shop for its records.",
    confirm: "Type DELETE", noDefault: "No default address yet.", ordered: "Placed {date} · {n} items", details: "Details", items: "{n} saved",
  },
  ar: {
    saved: "تم الحفظ.", error: "يرجى التحقق من المعلومات والمحاولة مجدداً.", confirmDelete: "اكتب DELETE للتأكيد.",
    staffDelete: "حسابات الفريق يحذفها المدير.", label: "الاسم", labelPh: "المنزل، العمل…", name: "الاسم الكامل", phone: "رقم الهاتف",
    region: "المحافظة", city: "المدينة أو البلدة", street: "الشارع والمبنى", floor: "الطابق والشقة", landmark: "أقرب معلم",
    makeDefault: "اجعله الافتراضي", default: "افتراضي", edit: "تعديل", remove: "حذف", add: "أضف عنواناً", save: "احفظ العنوان",
    noAddress: "لا عناوين محفوظة بعد. أضف عنواناً ونملؤه لك عند الدفع.", height: "الطول (سم)", how: "كيف تحب القياس؟",
    tops: "القمصان والجاكيتات", pants: "البناطيل", hijab: "الحجاب الرياضي", saveFit: "احفظ مقاسي",
    fitIntro: "نستخدم مقاسك لاختيار المقاس مسبقاً في كل منتج، وللرد أسرع على واتساب.",
    noFit: "لم تحفظ مقاسك بعد.", wishEmpty: "لا شيء محفوظ بعد. اضغط القلب على أي منتج لحفظه هنا.", view: "عرض",
    email: "البريد الإلكتروني", language: "اللغة", wa: "تحديثات واتساب", waBody: "حالة الطلب، الإصدارات الجديدة وأيام المسارات.", saveChanges: "احفظ التغييرات",
    danger: "احذف حسابي", dangerBody: "يُحذف حسابك وعناوينك ومقاسك والمفضّلة. تبقى الطلبات السابقة لدى المتجر لسجلاته.",
    confirm: "اكتب DELETE", noDefault: "لا عنوان افتراضي بعد.", ordered: "بتاريخ {date} · {n} قطع", details: "التفاصيل", items: "{n} محفوظة",
  },
};

const STYLES = ["Loose", "Relaxed", "Regular"] as const;
const TOP_SIZES = ["", "XS", "S", "M", "L", "XL", "XXL"];
const PANT_SIZES = ["", "XS", "S", "M", "L", "XL", "XXL", "28", "30", "32", "34", "36", "38"];

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/orders");
  const uid = session.user.id;

  const sp = await searchParams;
  const tab: Tab = TABS.find((k) => k === sp.tab) ?? "overview";
  const [{ dict: t, locale }, remembered] = await Promise.all([getI18n(), rememberedOrders()]);
  const l = L[locale];
  const a = t.design.account;

  const [user, orders, addresses, wishlist, fact] = await Promise.all([
    prisma.user.findUnique({ where: { id: uid } }),
    prisma.order.findMany({
      where: { OR: [{ userId: uid }, ...(remembered.length ? [{ orderNumber: { in: remembered } }] : [])] },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.address.findMany({ where: { userId: uid }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] }),
    prisma.wishlistItem.findMany({
      where: { userId: uid },
      include: { product: { select: { id: true, slug: true, name: true, nameAr: true, imageUrl: true, price: true, discount: true } } },
      orderBy: { createdAt: "desc" },
    }),
    siteFacts(locale),
  ]);
  if (!user) redirect("/login?callbackUrl=/orders");

  const staff = user.role === "ADMIN" || user.role === "MANAGER";
  const firstName = (user.name ?? "").split(" ")[0] || user.email;
  const initial = (user.name ?? user.email).trim().charAt(0).toUpperCase();
  const replyTime = fact("reply_time", "[Reply time]");
  const defaultAddress = addresses.find((x) => x.isDefault) ?? addresses[0];
  const regionName = (id: string) => regions.find((r) => r.id === id)?.[locale] ?? id;
  const flash = sp.saved ? "saved" : sp.error ? "error" : sp.confirm ? "confirm" : sp.staff ? "staff" : null;
  const icon = "h-[18px] w-[18px] shrink-0";

  const tabs = [
    { key: "overview", label: a.tabs.overview, icon: <Home className={icon} strokeWidth={1.6} /> },
    { key: "orders", label: a.tabs.orders, icon: <ShoppingBag className={icon} strokeWidth={1.6} /> },
    { key: "addresses", label: a.tabs.addresses, icon: <MapPin className={icon} strokeWidth={1.6} /> },
    { key: "fit", label: a.tabs.fit, icon: <Ruler className={icon} strokeWidth={1.6} /> },
    { key: "wishlist", label: a.tabs.wishlist, icon: <Heart className={icon} strokeWidth={1.6} /> },
    { key: "details", label: a.tabs.details, icon: <User className={icon} strokeWidth={1.6} /> },
  ];

  const orderCard = (order: (typeof orders)[number], latest = false) => {
    const cancelled = order.status === "CANCELLED";
    const step = Math.max(0, statusFlow.indexOf(order.status as (typeof statusFlow)[number]));
    const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
    return (
      <li key={order.id} className="rounded-[10px] border border-hairline p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {latest && <p className="eyebrow text-signal">{a.latest}</p>}
            <p className="mt-1 break-all text-[17px] font-bold">
              <bdi dir="ltr">{order.orderNumber}</bdi>
            </p>
            <p className="mt-1 text-[13.5px] text-ash">
              {fmt(l.ordered, { date: formatDate(order.createdAt, locale), n: units })} · <bdi dir="ltr">{formatPrice(order.total)}</bdi>
            </p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold ${cancelled ? "bg-signal/10 text-signal" : "bg-forest text-white"}`}>
            {t.track.statuses[order.status] ?? order.status}
          </span>
        </div>

        {!cancelled && (
          <ol className="mt-5 grid grid-cols-5" aria-label={t.track.statuses[order.status] ?? order.status}>
            {statusFlow.map((st, i) => {
              const reached = i <= step;
              return (
                <li key={st} className="flex flex-col items-start">
                  <span className="flex w-full items-center">
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${reached ? "bg-charcoal text-white" : "border-2 border-charcoal/25 bg-white"}`}>
                      {reached && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    {i < statusFlow.length - 1 && <span className={`h-0.5 flex-1 ${i < step ? "bg-charcoal" : "bg-charcoal/15"}`} />}
                  </span>
                  <span className={`mt-2 pe-1 text-[10.5px] leading-tight md:text-[12.5px] ${i === step ? "font-bold" : reached ? "" : "text-ash"}`}>
                    {t.track.statuses[st] ?? st}
                  </span>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex -space-x-3 rtl:space-x-reverse">
            {order.items.slice(0, 4).map((item) => {
              const product = item.variant.product;
              return (
                <span key={item.id} className="card-img relative h-14 w-12 border-2 border-white">
                  {product.imageUrl && <Img src={product.imageUrl} alt={(locale === "ar" && product.nameAr) || product.name} fill sizes="48px" className="object-cover" />}
                </span>
              );
            })}
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <a href={whatsappLink(`${a.ask}: ${order.orderNumber}`)} target="_blank" rel="noreferrer" className="btn btn-dark btn-sm flex-1 sm:flex-none">
              <WhatsAppIcon className="h-4 w-4" /> {a.ask}
            </a>
            <Link href={`/order/${order.orderNumber}`} className="btn btn-outline btn-sm flex-1 sm:flex-none">
              {l.details}
            </Link>
          </div>
        </div>
      </li>
    );
  };

  const addressForm = (x?: (typeof addresses)[number]) => (
    <form action={saveAddress} className="grid gap-4 sm:grid-cols-2">
      {x && <input type="hidden" name="id" value={x.id} />}
      <Field label={l.label}>
        <input name="label" required maxLength={40} defaultValue={x?.label ?? "Home"} placeholder={l.labelPh} className="field" />
      </Field>
      <Field label={l.name}>
        <input name="name" required minLength={2} maxLength={80} defaultValue={x?.name ?? user.name ?? ""} autoComplete="name" className="field" />
      </Field>
      <Field label={l.phone}>
        <div className="flex" dir="ltr">
          <span className="grid shrink-0 place-items-center rounded-s border border-e-0 border-charcoal/45 bg-stone px-3 text-[14px] font-semibold">{store.phonePrefix}</span>
          <input name="phone" required inputMode="tel" defaultValue={x?.phone ?? user.phone ?? ""} placeholder="70 123 456" className="field rounded-s-none" />
        </div>
      </Field>
      <Field label={l.region}>
        <select name="region" required defaultValue={x?.region ?? ""} className="field">
          <option value="" disabled>
            {t.checkout.selectRegion}
          </option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r[locale]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={l.city}>
        <input name="city" required minLength={2} defaultValue={x?.city ?? ""} placeholder="Achrafieh, Jounieh, Saida" className="field" />
      </Field>
      <Field label={l.street}>
        <input name="street" required minLength={3} defaultValue={x?.street ?? ""} autoComplete="street-address" className="field" />
      </Field>
      <Field label={l.floor}>
        <input name="floor" defaultValue={x?.floor ?? ""} className="field" />
      </Field>
      <Field label={l.landmark}>
        <input name="landmark" defaultValue={x?.landmark ?? ""} className="field" />
      </Field>
      <label className="flex items-center gap-3 text-[14px] sm:col-span-2">
        <input type="checkbox" name="isDefault" defaultChecked={x?.isDefault ?? addresses.length === 0} className="h-[18px] w-[18px] accent-[#313B2B]" />
        {l.makeDefault}
      </label>
      <div className="sm:col-span-2">
        <button type="submit" className="btn btn-primary w-full sm:w-auto">
          {l.save}
        </button>
      </div>
    </form>
  );

  return (
    <>
      {/* Greeting band */}
      <section className="bg-stone">
        <div className="container-x flex items-center justify-between gap-4 py-5 md:py-9">
          <div className="flex min-w-0 items-center gap-3 md:gap-5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-forest text-[18px] font-bold text-white md:h-16 md:w-16 md:text-[20px]">
              {initial}
            </span>
            <div className="min-w-0">
              <h1 className="display break-words text-[clamp(28px,8vw,56px)] leading-[0.95]">{fmt(a.hello, { name: firstName })}</h1>
              <p className="mt-1 truncate text-[13px] text-ash md:text-[14px]">
                {fmt(a.memberSince, { date: formatDate(user.createdAt, locale) })} · <span lang={locale === "ar" ? "en" : "ar"}>{a.helloAlt}</span>
              </p>
            </div>
          </div>
          <SignOutButton label={t.auth.signOut} className="btn btn-outline btn-sm hidden shrink-0 md:inline-flex" />
        </div>
      </section>

      <section className="container-x pb-16 pt-4 md:pb-28 md:pt-9">
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-10">
          {/* Tabs: a scrolling pill row on phones, a side menu on desktop */}
          <aside className="min-w-0 lg:col-span-3">
            <nav className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 md:-mx-8 md:px-8 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0" aria-label={t.ui.myAccount}>
              {tabs.map((x) => {
                const on = x.key === tab;
                return (
                  <Link
                    key={x.key}
                    href={x.key === "overview" ? "/orders" : `/orders?tab=${x.key}`}
                    aria-current={on ? "page" : undefined}
                    scroll={false}
                    className={`flex shrink-0 snap-start items-center gap-2.5 rounded-full px-4 py-2.5 text-[14px] font-medium transition-colors lg:rounded-[10px] lg:py-3 lg:text-[15px] ${
                      on ? "bg-forest text-white" : "bg-stone hover:bg-sand lg:bg-transparent lg:hover:bg-stone"
                    }`}
                  >
                    {x.icon}
                    {x.label}
                  </Link>
                );
              })}
              {staff && (
                <Link href="/admin" className="flex shrink-0 items-center gap-2.5 rounded-full bg-stone px-4 py-2.5 text-[14px] font-medium lg:rounded-[10px] lg:bg-transparent lg:py-3 lg:hover:bg-stone">
                  <LayoutDashboard className={icon} strokeWidth={1.6} />
                  {t.auth.staff}
                </Link>
              )}
            </nav>
            <div className="mt-5 hidden rounded-[10px] bg-forest p-5 text-sand lg:block">
              <p className="text-[15px] font-bold text-white">{a.help}</p>
              <p className="mt-1 text-[14px]">{fmt(a.helpBody, { time: replyTime })}</p>
            </div>
          </aside>

          <div className="min-w-0 lg:col-span-9">
            <h2 className="display text-[2.2rem] md:text-[3.2rem]">{tabs.find((x) => x.key === tab)?.label}</h2>

            {flash && (
              <p
                role="status"
                className={`mt-4 flex items-center gap-2 rounded-[4px] px-4 py-3 text-[14px] ${flash === "saved" ? "bg-[#E8F1E6] text-[#2E7D32]" : "bg-[#EEEEE7] text-signal"}`}
              >
                {flash === "saved" ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {flash === "saved" ? l.saved : flash === "confirm" ? l.confirmDelete : flash === "staff" ? l.staffDelete : l.error}
              </p>
            )}

            {/* OVERVIEW */}
            {tab === "overview" && (
              <div className="mt-5 grid gap-4">
                {orders[0] ? (
                  <ul>{orderCard(orders[0], true)}</ul>
                ) : (
                  <Empty icon={<Package className="h-9 w-9" strokeWidth={1.2} />} text={a.noOrders} cta={{ href: "/shop", label: t.common.shopAll }} />
                )}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card eyebrow={a.fitTitle}>
                    {user.fitTops && <p className="display text-[30px] leading-none">{`${user.fitTops} · ${user.fitStyle ?? ""}`}</p>}
                    <p className="mt-2 text-[14px] text-ash">
                      {user.fitTops || user.fitPants || user.fitHijab
                        ? [user.fitTops && `${l.tops} ${user.fitTops}`, user.fitPants && `${l.pants} ${user.fitPants}`, user.fitHijab && `${l.hijab} ${user.fitHijab}`]
                            .filter(Boolean)
                            .join(" · ")
                        : l.noFit}
                    </p>
                    <TabLink tab="fit" label={a.fitTitle} />
                  </Card>
                  <Card eyebrow={a.tabs.addresses}>
                    {defaultAddress ? (
                      <>
                        <p className="text-[16px] font-bold">
                          {defaultAddress.label} · {regionName(defaultAddress.region)}
                        </p>
                        <p className="mt-2 text-[14px] text-ash">
                          {[defaultAddress.street, defaultAddress.floor, defaultAddress.city].filter(Boolean).join(", ")}
                          {defaultAddress.landmark && ` · ${defaultAddress.landmark}`}
                        </p>
                      </>
                    ) : (
                      <p className="text-[14px] text-ash">{l.noDefault}</p>
                    )}
                    <TabLink tab="addresses" label={a.tabs.addresses} />
                  </Card>
                  <div className="flex flex-col rounded-[10px] bg-forest p-5 text-sand">
                    <p className="eyebrow text-khaki-60">{a.tabs.wishlist}</p>
                    <p className="display mt-2 text-[30px] leading-none text-white">{fmt(l.items, { n: wishlist.length })}</p>
                    <p className="mt-2 text-[14px]">{a.wishlistEmpty}</p>
                    <Link href="/orders?tab=wishlist" className="mt-auto pt-4 text-[14px] font-bold text-white underline underline-offset-4">
                      {a.tabs.wishlist}
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* ORDERS */}
            {tab === "orders" &&
              (orders.length ? (
                <ul className="mt-5 space-y-4">{orders.map((o) => orderCard(o))}</ul>
              ) : (
                <div className="mt-5">
                  <Empty icon={<Package className="h-9 w-9" strokeWidth={1.2} />} text={a.noOrders} cta={{ href: "/shop", label: t.common.shopAll }} />
                </div>
              ))}

            {/* ADDRESSES */}
            {tab === "addresses" && (
              <div className="mt-5 grid gap-4">
                {addresses.length === 0 && <p className="text-[15px] text-ash">{l.noAddress}</p>}
                {addresses.map((x) => (
                  <div key={x.id} className="rounded-[10px] border border-hairline p-4 md:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[16px] font-bold">
                          {x.label}
                          {x.isDefault && <span className="rounded-full bg-forest px-2.5 py-0.5 text-[11px] font-bold text-white">{l.default}</span>}
                        </p>
                        <p className="mt-1 text-[14px]">
                          {x.name} · <bdi dir="ltr">{x.phone}</bdi>
                        </p>
                        <p className="mt-1 text-[14px] text-ash">
                          {[x.street, x.floor, x.city, regionName(x.region)].filter(Boolean).join(", ")}
                          {x.landmark && ` · ${x.landmark}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {!x.isDefault && (
                          <form action={makeDefaultAddress}>
                            <input type="hidden" name="id" value={x.id} />
                            <button className="btn btn-outline btn-sm">{l.makeDefault}</button>
                          </form>
                        )}
                        <form action={deleteAddress}>
                          <input type="hidden" name="id" value={x.id} />
                          <button className="btn btn-outline btn-sm">{l.remove}</button>
                        </form>
                      </div>
                    </div>
                    <details className="smooth group mt-3 border-t border-hairline pt-3">
                      <summary className="cursor-pointer list-none text-[14px] font-bold underline underline-offset-4 [&::-webkit-details-marker]:hidden">{l.edit}</summary>
                      <div className="mt-4">{addressForm(x)}</div>
                    </details>
                  </div>
                ))}
                <details className="smooth rounded-[10px] bg-stone p-4 md:p-6" open={addresses.length === 0}>
                  <summary className="cursor-pointer list-none text-[16px] font-bold [&::-webkit-details-marker]:hidden">+ {l.add}</summary>
                  <div className="mt-4">{addressForm()}</div>
                </details>
              </div>
            )}

            {/* MY FIT */}
            {tab === "fit" && (
              <form action={saveFit} className="mt-5 grid max-w-2xl gap-5 rounded-[10px] bg-stone p-4 md:p-6">
                <p className="text-[15px] text-ash">{l.fitIntro}</p>
                <Field label={l.height}>
                  <input name="fitHeight" type="number" min={100} max={230} inputMode="numeric" defaultValue={user.fitHeight ?? ""} placeholder="170" className="field max-w-40" />
                </Field>
                <fieldset>
                  <legend className="field-label">{l.how}</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {STYLES.map((st) => (
                      <label key={st} className="relative">
                        <input type="radio" name="fitStyle" value={st} defaultChecked={(user.fitStyle ?? "Loose") === st} className="peer sr-only" />
                        <span className="grid h-11 cursor-pointer place-items-center rounded-[4px] border border-charcoal/40 bg-white text-[14px] font-medium peer-checked:border-charcoal peer-checked:bg-charcoal peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2">
                          {st}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={l.tops}>
                    <SizeSelect name="fitTops" value={user.fitTops} options={TOP_SIZES} />
                  </Field>
                  <Field label={l.pants}>
                    <SizeSelect name="fitPants" value={user.fitPants} options={PANT_SIZES} />
                  </Field>
                  <Field label={l.hijab}>
                    <SizeSelect name="fitHijab" value={user.fitHijab} options={["", "One size"]} />
                  </Field>
                </div>
                <div>
                  <button type="submit" className="btn btn-primary w-full sm:w-auto">
                    {l.saveFit}
                  </button>
                </div>
              </form>
            )}

            {/* WISHLIST */}
            {tab === "wishlist" &&
              (wishlist.length ? (
                <ul className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
                  {wishlist.map(({ product: p }) => (
                    <li key={p.id} className="flex flex-col">
                      <Link href={`/products/${p.slug}`} className="card-img relative block aspect-[3/4] bg-stone">
                        {p.imageUrl && <Img src={p.imageUrl} alt={(locale === "ar" && p.nameAr) || p.name} fill sizes="(min-width:768px) 30vw, 48vw" className="object-cover" />}
                      </Link>
                      <div className="mt-2 flex items-start justify-between gap-2">
                        <p className="min-w-0 text-[14px] font-bold leading-snug">{(locale === "ar" && p.nameAr) || p.name}</p>
                        <p className="shrink-0 text-[14px] font-bold" dir="ltr">
                          {formatPrice(discountedPrice(p.price, p.discount))}
                        </p>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Link href={`/products/${p.slug}`} className="btn btn-primary btn-sm flex-1">
                          {l.view}
                        </Link>
                        <form action={removeFromWishlist}>
                          <input type="hidden" name="productId" value={p.id} />
                          <button className="btn btn-outline btn-sm px-3" aria-label={l.remove}>
                            <Heart className="h-4 w-4 fill-signal text-signal" />
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-5">
                  <Empty icon={<Heart className="h-9 w-9" strokeWidth={1.2} />} text={l.wishEmpty} cta={{ href: "/shop", label: t.common.shopAll }} />
                </div>
              ))}

            {/* ACCOUNT DETAILS */}
            {tab === "details" && (
              <div className="mt-5 grid max-w-2xl gap-6">
                <form action={saveDetails} className="grid gap-4 rounded-[10px] bg-stone p-4 md:p-6">
                  <Field label={l.name}>
                    <input name="name" required minLength={2} maxLength={80} defaultValue={user.name ?? ""} autoComplete="name" className="field" />
                  </Field>
                  <Field label={l.phone}>
                    <div className="flex" dir="ltr">
                      <span className="grid shrink-0 place-items-center rounded-s border border-e-0 border-charcoal/45 bg-white px-3 text-[14px] font-semibold">{store.phonePrefix}</span>
                      <input name="phone" inputMode="tel" defaultValue={user.phone ?? ""} placeholder="70 123 456" className="field rounded-s-none" />
                    </div>
                  </Field>
                  <Field label={l.email}>
                    <input value={user.email} readOnly dir="ltr" className="field bg-cream-2 text-ash" aria-readonly="true" />
                  </Field>
                  <Field label={l.language}>
                    <select name="locale" defaultValue={user.locale ?? locale} className="field">
                      <option value="en">English</option>
                      <option value="ar">العربية</option>
                    </select>
                  </Field>
                  <label className="flex items-start gap-3 rounded-[4px] bg-white p-3">
                    <input type="checkbox" name="waUpdates" defaultChecked={user.waUpdates} className="mt-1 h-[18px] w-[18px] accent-[#313B2B]" />
                    <span>
                      <b className="block text-[15px]">{l.wa}</b>
                      <span className="text-[13.5px] text-ash">{l.waBody}</span>
                    </span>
                  </label>
                  <div>
                    <button type="submit" className="btn btn-primary w-full sm:w-auto">
                      {l.saveChanges}
                    </button>
                  </div>
                </form>

                {!staff && (
                  <form action={deleteAccount} className="grid gap-3 rounded-[10px] border border-signal/30 p-4 md:p-6">
                    <p className="text-[16px] font-bold text-signal">{l.danger}</p>
                    <p className="text-[14px] text-ash">{l.dangerBody}</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input name="confirm" required placeholder={l.confirm} aria-label={l.confirm} autoComplete="off" className="field sm:max-w-56" />
                      <button type="submit" className="btn btn-outline border-signal text-signal">
                        {l.danger}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            <div className="mt-6 rounded-[10px] bg-forest p-5 text-sand lg:hidden">
              <p className="text-[15px] font-bold text-white">{a.help}</p>
              <p className="mt-1 text-[14px]">{fmt(a.helpBody, { time: replyTime })}</p>
            </div>
            <SignOutButton label={t.auth.signOut} className="btn btn-outline mt-4 w-full md:hidden" />
          </div>
        </div>
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function Card({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-[10px] bg-stone p-5">
      <p className="eyebrow mb-2 text-ash">{eyebrow}</p>
      {children}
    </div>
  );
}

function TabLink({ tab, label }: { tab: string; label: string }) {
  return (
    <Link href={`/orders?tab=${tab}`} className="mt-auto inline-flex items-center gap-1 pt-4 text-[14px] font-bold underline underline-offset-4">
      {label} <ArrowRight className="flip-rtl h-3.5 w-3.5" />
    </Link>
  );
}

function SizeSelect({ name, value, options }: { name: string; value: string | null; options: string[] }) {
  return (
    <select name={name} defaultValue={value ?? ""} className="field" dir="ltr">
      {options.map((o) => (
        <option key={o} value={o}>
          {o || "—"}
        </option>
      ))}
    </select>
  );
}

function Empty({ icon, text, cta }: { icon: React.ReactNode; text: string; cta: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[10px] border border-hairline p-6 md:p-8">
      <span className="text-ash">{icon}</span>
      <p className="max-w-md text-[15px]">{text}</p>
      <Link href={cta.href} className="btn btn-primary btn-sm">
        {cta.label}
      </Link>
    </div>
  );
}
