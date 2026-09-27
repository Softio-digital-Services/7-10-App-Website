"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Banknote, ChevronDown, LoaderCircle, Lock, ShoppingBag, Wallet } from "lucide-react";
import { Brackets } from "@/components/brand/brackets";
import { useCart } from "@/components/cart-provider";
import { Field } from "@/components/form-field";
import { useI18n } from "@/components/i18n-provider";
import { Img } from "@/components/img";
import { formatPrice, isValidPhone } from "@/lib/format";
import { deliveryFeeFor, regions, store } from "@/lib/store-config";

type Form = {
  name: string;
  phone: string;
  email: string;
  region: string;
  city: string;
  address: string;
  notes: string;
  payment: "COD" | "WHISH";
};
type FieldKey = Exclude<keyof Form, "payment" | "notes">;
type Errors = Partial<Record<FieldKey, string>>;

const SAVED_KEY = "710.checkout.v1";
const fieldOrder: FieldKey[] = ["name", "phone", "email", "region", "city", "address"];

function readSaved(): Partial<Omit<Form, "payment">> & { payment?: string } {
  if (typeof window === "undefined") return {};
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_KEY) ?? "null") as Record<string, unknown> | null;
    if (!saved) return {};
    return Object.fromEntries(Object.entries(saved).filter(([, v]) => typeof v === "string" && v)) as Partial<Omit<Form, "payment">> & { payment?: string };
  } catch {
    return {};
  }
}

export function CheckoutView({ account }: { account: { name: string; email: string } | null }) {
  const { t, f, locale } = useI18n();
  const router = useRouter();
  const { items, ready, subtotal, count, syncStock, refresh, clearCart } = useCart();

  // The form only renders once the bag is hydrated, so reading saved details here can't cause a hydration mismatch.
  const [form, setForm] = useState<Form>(() => {
    const saved = readSaved();
    const payment = saved.payment === "WHISH" || saved.payment === "CARD" ? "WHISH" : "COD";
    return {
      name: account?.name ?? "",
      phone: "",
      email: account?.email ?? "",
      region: "",
      city: "",
      address: "",
      notes: "",
      ...saved,
      payment,
    };
  });
  const [errors, setErrors] = useState<Errors>({});
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState<"idle" | "placing" | "done">("idle");
  const [banner, setBanner] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  const check = (key: FieldKey, value: string): string | undefined => {
    const v = value.trim();
    switch (key) {
      case "name":
        return v.length >= 2 ? undefined : t.checkout.errName;
      case "phone":
        return isValidPhone(v) ? undefined : t.checkout.errPhone;
      case "email":
        return !v || /^\S+@\S+\.\S+$/.test(v) ? undefined : t.checkout.errEmail;
      case "region":
        return regions.some((r) => r.id === v) ? undefined : t.checkout.errRegion;
      case "city":
        return v.length >= 2 ? undefined : t.checkout.errCity;
      case "address":
        return v.length >= 5 ? undefined : t.checkout.errAddress;
    }
  };

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: check(key as FieldKey, value as string) }));
  };

  const blur = (key: FieldKey) => {
    if (form[key].trim() || errors[key]) setErrors((e) => ({ ...e, [key]: check(key, form[key]) }));
  };

  const fee = form.region ? deliveryFeeFor(form.region, subtotal) : null;
  const total = subtotal + (fee ?? 0);
  const remaining = Math.max(0, store.freeDeliveryOver - subtotal);

  const focusFirst = (errs: Errors) => {
    const first = fieldOrder.find((k) => errs[k]);
    if (first) document.getElementById(`co-${first}`)?.focus({ preventScroll: false });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== "idle") return;

    const errs: Errors = {};
    for (const key of fieldOrder) {
      const msg = check(key, form[key]);
      if (msg) errs[key] = msg;
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      setBanner(t.checkout.fixErrors);
      focusFirst(errs);
      return;
    }

    setStatus("placing");
    setBanner(null);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        notes: form.notes.trim() || undefined,
        locale,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;

    if (res?.status === 201 && data?.orderNumber) {
      const { name, phone, email, region, city, address, payment } = form;
      if (remember) localStorage.setItem(SAVED_KEY, JSON.stringify({ name, phone, email, region, city, address, payment }));
      else localStorage.removeItem(SAVED_KEY);
      setStatus("done");
      clearCart();
      if (data.payUrl) {
        window.location.href = data.payUrl;
        return;
      }
      router.push(`/order/${data.orderNumber}`);
      return;
    }

    setStatus("idle");
    if (res?.status === 503 && data?.error === "whish_not_configured") {
      setBanner(t.checkout.errWhishSetup);
    } else if (res?.status === 409 && data?.stock) {
      syncStock(data.stock);
      setBanner(t.checkout.errStock);
    } else if (res?.status === 400 && Array.isArray(data?.fields)) {
      const fieldErrs: Errors = {};
      for (const k of data.fields as string[]) {
        if ((fieldOrder as string[]).includes(k)) fieldErrs[k as FieldKey] = check(k as FieldKey, "") ?? t.checkout.fixErrors;
      }
      setErrors(fieldErrs);
      setBanner(t.checkout.fixErrors);
      focusFirst(fieldErrs);
      return;
    } else {
      setBanner(t.common.somethingWrong);
    }
    requestAnimationFrame(() => bannerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  if (!ready) {
    return (
      <div className="container-x grid gap-12 pb-24 pt-12 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="skeleton h-16 w-2/3" />
          <div className="skeleton h-14" />
          <div className="skeleton h-14" />
          <div className="skeleton h-14" />
        </div>
        <div className="skeleton h-96 lg:col-span-5" />
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="container-x grid min-h-[60vh] place-items-center py-24 text-center">
        <div>
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-olive" />
          <p className="display mt-6 text-3xl">{t.checkout.placing}</p>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-x py-20 md:py-28">
        <div className="relative mx-auto max-w-xl border border-charcoal/15 px-6 py-16 text-center">
          <Brackets size="sm" inset="-1px" className="text-charcoal/60" />
          <ShoppingBag className="mx-auto h-8 w-8 text-charcoal/40" strokeWidth={1.25} />
          <h1 className="display mt-6 text-4xl md:text-5xl">{t.checkout.emptyTitle}</h1>
          <p className="mt-3 text-charcoal/65">{t.checkout.emptyBody}</p>
          <Link href="/shop" className="btn btn-primary mt-8">
            {t.common.shopAll}
          </Link>
        </div>
      </div>
    );
  }

  const summary = (
    <>
      <ul className="divide-y divide-charcoal/10">
        {items.map((item) => (
          <li key={item.variantId} className="flex gap-4 py-4 first:pt-0">
            <div className="card-img relative h-24 w-[72px] shrink-0">
              {item.imageUrl && <Img src={item.imageUrl} alt={item.productName} fill sizes="72px" className="object-cover" />}
              <span className="absolute -end-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-charcoal px-1.5 font-display text-[11px] text-cream">
                {item.quantity}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-medium">{item.productName}</p>
                <p className="mt-0.5 text-[13px] text-charcoal/55">
                  {t.bag.size}: <span dir="ltr">{item.size}</span>
                </p>
              </div>
              <div className="shrink-0 text-end text-[14.5px]" dir="ltr">
                <p className="font-medium">{formatPrice(item.price * item.quantity)}</p>
                {item.compareAt && <p className="text-[12.5px] text-charcoal/40 line-through">{formatPrice(item.compareAt * item.quantity)}</p>}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <dl className="mt-5 space-y-3 border-t border-charcoal/10 pt-5 text-[14.5px]">
        <div className="flex justify-between">
          <dt className="text-charcoal/70">
            {t.checkout.subtotal} · {f(count === 1 ? t.bag.countOne : t.bag.count, { n: count })}
          </dt>
          <dd dir="ltr">{formatPrice(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-charcoal/70">{t.checkout.deliveryFee}</dt>
          <dd dir="ltr" className={fee === 0 ? "font-medium text-olive" : fee === null ? "text-charcoal/45" : ""}>
            {fee === null ? t.checkout.selectRegionFirst : fee === 0 ? t.common.free : formatPrice(fee)}
          </dd>
        </div>
        {remaining > 0 && (
          <p className="text-[12.5px] text-charcoal/55">{f(t.bag.freeProgress, { amount: formatPrice(remaining) })}</p>
        )}
      </dl>

      <div className="mt-5 flex items-end justify-between border-t border-charcoal pt-5">
        <span className="eyebrow">{t.checkout.total}</span>
        <span className="font-display text-3xl font-medium" dir="ltr">
          <span className="me-1.5 align-middle text-[12px] font-normal text-charcoal/50">{store.currency}</span>
          {formatPrice(total)}
        </span>
      </div>
    </>
  );

  const placeButton = (className: string) => (
    <button type="submit" disabled={status === "placing"} className={`btn btn-primary w-full min-h-14 text-[13.5px] ${className}`}>
      {status === "placing" ? (
        <>
          <LoaderCircle className="h-4 w-4 animate-spin" /> {form.payment === "WHISH" ? t.checkout.openingWhish : t.checkout.placing}
        </>
      ) : (
        <>
          <Lock className="h-4 w-4" strokeWidth={1.75} />
          {form.payment === "WHISH" ? t.checkout.payWhish : t.checkout.place} — <span dir="ltr">{formatPrice(total)}</span>
        </>
      )}
    </button>
  );

  return (
    <div className="container-x pb-24 pt-8 md:pt-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2 text-charcoal/55">
            <Lock className="h-3.5 w-3.5" strokeWidth={1.75} /> {t.checkout.secure}
          </p>
          <h1 className="display mt-4 text-5xl md:text-7xl">{t.checkout.title}</h1>
        </div>
        <Link href="/cart" className="link-line eyebrow">
          {t.checkout.editBag}
        </Link>
      </div>
      {!account && (
        <p className="mt-4 text-[14px] text-charcoal/60">
          {t.checkout.guestNote} {t.checkout.haveAccount}{" "}
          <Link href="/login?callbackUrl=/checkout" className="text-charcoal underline underline-offset-4">
            {t.common.signIn}
          </Link>
        </p>
      )}

      {/* Mobile summary */}
      <div className="mt-8 border border-charcoal/15 lg:hidden">
        <button
          type="button"
          onClick={() => setSummaryOpen((v) => !v)}
          aria-expanded={summaryOpen}
          className="flex w-full items-center justify-between gap-3 bg-cream-2 px-5 py-4 text-[14px]"
        >
          <span className="flex items-center gap-2 font-medium">
            <ShoppingBag className="h-4 w-4" strokeWidth={1.5} />
            {summaryOpen ? t.checkout.hideSummary : t.checkout.showSummary}
            <ChevronDown className={`h-4 w-4 transition-transform ${summaryOpen ? "rotate-180" : ""}`} />
          </span>
          <span className="font-display text-lg" dir="ltr">{formatPrice(total)}</span>
        </button>
        <div className={`grid transition-[grid-template-rows] duration-500 ease-[var(--ease-out-expo)] ${summaryOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <div className="overflow-hidden">
            <div className="p-5">{summary}</div>
          </div>
        </div>
      </div>

      <form noValidate onSubmit={submit} className="mt-8 grid gap-12 md:mt-12 lg:grid-cols-12 lg:gap-16">
        <div className="space-y-12 lg:col-span-7">
          {banner && (
            <div ref={bannerRef} role="alert" className="flex items-start gap-3 border border-signal/40 bg-signal/5 px-5 py-4 text-[14px] text-charcoal">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
              {banner}
            </div>
          )}

          <Step index="01" title={t.checkout.contact}>
            <Field id="co-name" label={t.checkout.fullName} error={errors.name}>
              <input
                id="co-name"
                className="field"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                onBlur={() => blur("name")}
                autoComplete="name"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "co-name-error" : undefined}
              />
            </Field>
            <Field id="co-phone" label={t.checkout.phone} error={errors.phone} hint={t.checkout.phoneHint}>
              <div className="flex" dir="ltr">
                <span className="grid shrink-0 place-items-center border border-e-0 border-charcoal/20 bg-cream-2 px-4 font-display text-[14px] tracking-wider">
                  {store.phonePrefix}
                </span>
                <input
                  id="co-phone"
                  className="field"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value.replace(/[^\d\s+-]/g, ""))}
                  onBlur={() => blur("phone")}
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="70 123 456"
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? "co-phone-error" : "co-phone-hint"}
                />
              </div>
            </Field>
            <Field id="co-email" label={t.checkout.email} optional error={errors.email} hint={t.checkout.emailHint}>
              <input
                id="co-email"
                type="email"
                className="field"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                onBlur={() => blur("email")}
                autoComplete="email"
                dir="ltr"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "co-email-error" : "co-email-hint"}
              />
            </Field>
          </Step>

          <Step index="02" title={t.checkout.delivery}>
            <Field id="co-region" label={t.checkout.region} error={errors.region}>
              <div className="relative">
                <select
                  id="co-region"
                  className="field cursor-pointer appearance-none pe-10"
                  value={form.region}
                  onChange={(e) => {
                    set("region", e.target.value);
                    setErrors((er) => ({ ...er, region: check("region", e.target.value) }));
                  }}
                  aria-invalid={!!errors.region}
                  aria-describedby={errors.region ? "co-region-error" : undefined}
                >
                  <option value="" disabled>
                    {t.checkout.selectRegion}
                  </option>
                  {regions.map((r) => {
                    const regionFee = deliveryFeeFor(r.id, subtotal);
                    return (
                      <option key={r.id} value={r.id}>
                        {r[locale]} — {regionFee === 0 ? t.common.free : formatPrice(regionFee)}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal/60" />
              </div>
            </Field>
            <Field id="co-city" label={t.checkout.city} error={errors.city}>
              <input
                id="co-city"
                className="field"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                onBlur={() => blur("city")}
                autoComplete="address-level2"
                aria-invalid={!!errors.city}
                aria-describedby={errors.city ? "co-city-error" : undefined}
              />
            </Field>
            <Field id="co-address" label={t.checkout.address} error={errors.address}>
              <input
                id="co-address"
                className="field"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
                onBlur={() => blur("address")}
                autoComplete="street-address"
                aria-invalid={!!errors.address}
                aria-describedby={errors.address ? "co-address-error" : undefined}
              />
            </Field>
            <Field id="co-notes" label={t.checkout.notes} optional>
              <textarea
                id="co-notes"
                className="field min-h-24 resize-y"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder={t.checkout.notesPlaceholder}
                maxLength={500}
                rows={3}
              />
            </Field>
          </Step>

          <Step index="03" title={t.checkout.payment}>
            <div className="grid gap-3" role="radiogroup" aria-label={t.checkout.payment}>
              <PaymentOption
                checked={form.payment === "COD"}
                onSelect={() => set("payment", "COD")}
                icon={<Banknote className="h-5 w-5" strokeWidth={1.5} />}
                title={t.checkout.cod}
                body={t.checkout.codDesc}
              />
              <PaymentOption
                checked={form.payment === "WHISH"}
                onSelect={() => set("payment", "WHISH")}
                icon={<Wallet className="h-5 w-5" strokeWidth={1.5} />}
                title={t.checkout.whish}
                body={t.checkout.whishDesc}
                extra={
                  <span className="flex gap-1.5" dir="ltr" aria-hidden="true">
                    {["WHISH", "VISA", "MC"].map((b) => (
                      <span key={b} className="border border-charcoal/20 px-1.5 py-0.5 font-display text-[9.5px] tracking-wider text-charcoal/60">
                        {b}
                      </span>
                    ))}
                  </span>
                }
              />
            </div>
          </Step>

          <div className="space-y-5">
            <label className="flex cursor-pointer items-center gap-3 text-[14px]">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-[18px] w-[18px] accent-[var(--color-olive)]" />
              {t.checkout.remember}
            </label>
            <div className="lg:hidden">{placeButton("")}</div>
            <p className="text-[12.5px] leading-relaxed text-charcoal/50 lg:hidden">
              {t.checkout.terms} {t.checkout.privacy}
            </p>
          </div>
        </div>

        <aside className="lg:col-span-5">
          <div className="lg:sticky lg:top-[100px]">
            <div className="hidden bg-cream-2 p-7 lg:block xl:p-9">
              <p className="eyebrow mb-6 text-charcoal/60">{t.checkout.summary}</p>
              {summary}
              <div className="mt-7">{placeButton("")}</div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-charcoal/50">
                {t.checkout.terms} {t.checkout.privacy}
              </p>
            </div>
            <ul className="mt-5 hidden grid-cols-3 gap-2 text-center text-[11.5px] text-charcoal/60 lg:grid">
              <li className="border border-charcoal/10 px-2 py-3">{t.home.uspCodTitle}</li>
              <li className="border border-charcoal/10 px-2 py-3">{f(t.home.uspDeliveryBody, { days: store.deliveryDays })}</li>
              <li className="border border-charcoal/10 px-2 py-3">{f(t.home.uspExchangeBody, { days: store.exchangeDays })}</li>
            </ul>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Step({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-6 flex items-center gap-4 border-b border-charcoal/10 pb-4">
        <span className="grid h-8 w-8 place-items-center bg-charcoal font-display text-[12px] text-cream" dir="ltr">
          {index}
        </span>
        <h2 className="display text-2xl md:text-3xl">{title}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function PaymentOption({ checked, onSelect, icon, title, body, extra }: { checked: boolean; onSelect: () => void; icon: React.ReactNode; title: string; body: string; extra?: React.ReactNode }) {
  return (
    <label
      className={`relative flex cursor-pointer items-start gap-4 border p-5 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-olive ${
        checked ? "border-charcoal bg-cream-2" : "border-charcoal/20 hover:border-charcoal/50"
      }`}
    >
      <input type="radio" name="payment" checked={checked} onChange={onSelect} className="sr-only" />
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${checked ? "border-charcoal" : "border-charcoal/30"}`}>
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-charcoal" />}
      </span>
      <span className="flex-1">
        <span className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5 text-[15px] font-medium">
            {icon}
            {title}
          </span>
          {extra}
        </span>
        <span className="mt-1.5 block text-[13.5px] leading-relaxed text-charcoal/65">{body}</span>
      </span>
    </label>
  );
}
