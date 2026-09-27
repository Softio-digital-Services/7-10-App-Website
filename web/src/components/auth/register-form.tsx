"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { AlertTriangle, ArrowRight, LoaderCircle } from "lucide-react";
import { GoogleIcon } from "@/components/auth/login-form";
import { PasswordInput } from "@/components/auth/password-input";
import { describedBy, Field } from "@/components/form-field";
import { useI18n } from "@/components/i18n-provider";

type Form = { name: string; email: string; password: string };
type Errors = Partial<Record<keyof Form, string>>;
const order: (keyof Form)[] = ["name", "email", "password"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function RegisterForm({ callbackUrl, explicitCallback, google }: { callbackUrl: string; explicitCallback: boolean; google: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [form, setForm] = useState<Form>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof Form, boolean>>>({});
  const [banner, setBanner] = useState<"taken" | "error" | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function validate(values: Form): Errors {
    const next: Errors = {};
    if (values.name.trim().length < 2) next.name = t.auth.errName;
    if (!EMAIL_RE.test(values.email.trim())) next.email = t.auth.errEmail;
    if (values.password.length < 8) next.password = t.auth.errPassword;
    return next;
  }

  function update(key: keyof Form, value: string) {
    const next = { ...form, [key]: value };
    setForm(next);
    if (touched[key]) setErrors((e) => ({ ...e, [key]: validate(next)[key] }));
  }

  function blur(key: keyof Form) {
    if (!form[key]) return;
    setTouched((s) => ({ ...s, [key]: true }));
    setErrors((e) => ({ ...e, [key]: validate(form)[key] }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    setTouched({ name: true, email: true, password: true });
    setBanner(null);
    const first = order.find((k) => found[k]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`#rg-${first}`)?.focus();
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), password: form.password }),
      });
      if (res.status === 409) {
        setBanner("taken");
        setPending(false);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const result = await signIn("credentials", { email: form.email.trim(), password: form.password, redirect: false });
      router.replace(result?.error ? "/login" : callbackUrl);
      router.refresh();
    } catch {
      setBanner("error");
      setPending(false);
    }
  }

  const loginHref = explicitCallback ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login";

  return (
    <>
      <form ref={formRef} onSubmit={submit} noValidate className="space-y-6">
        {banner && (
          <div role="alert" className="flex items-start gap-3 border border-signal/40 bg-signal/5 px-5 py-4 text-[14px]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
            <p>
              {banner === "taken" ? t.auth.emailTaken : t.auth.registerError}{" "}
              {banner === "taken" && (
                <Link href={loginHref} className="font-medium underline underline-offset-4">
                  {t.auth.signInCta}
                </Link>
              )}
            </p>
          </div>
        )}
        <Field id="rg-name" label={t.auth.name} error={errors.name}>
          <input
            id="rg-name"
            autoComplete="name"
            className="field"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            onBlur={() => blur("name")}
            aria-invalid={!!errors.name}
            aria-describedby={describedBy("rg-name", errors.name)}
          />
        </Field>
        <Field id="rg-email" label={t.auth.email} error={errors.email}>
          <input
            id="rg-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            className="field text-left"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            onBlur={() => blur("email")}
            aria-invalid={!!errors.email}
            aria-describedby={describedBy("rg-email", errors.email)}
          />
        </Field>
        <Field id="rg-password" label={t.auth.password} error={errors.password} hint={t.auth.passwordHint}>
          <PasswordInput
            id="rg-password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            onBlur={() => blur("password")}
            aria-invalid={!!errors.password}
            aria-describedby={describedBy("rg-password", errors.password, t.auth.passwordHint)}
          />
          <PasswordMeter value={form.password} />
        </Field>
        <button type="submit" disabled={pending} className="btn btn-primary w-full">
          {pending ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" /> {t.auth.creating}
            </>
          ) : (
            <>
              {t.auth.registerCta} <ArrowRight className="flip-rtl h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {google && (
        <>
          <div className="my-7 flex items-center gap-4 text-[12px] uppercase tracking-[0.2em] text-charcoal/40">
            <span className="h-px flex-1 bg-charcoal/15" />
            {t.auth.or}
            <span className="h-px flex-1 bg-charcoal/15" />
          </div>
          <button type="button" onClick={() => signIn("google", { callbackUrl })} className="btn btn-outline w-full">
            <GoogleIcon /> {t.auth.google}
          </button>
        </>
      )}

      <p className="mt-8 text-[14.5px] text-charcoal/70">
        {t.auth.haveAccount}{" "}
        <Link href={loginHref} className="font-medium text-charcoal underline underline-offset-4">
          {t.auth.signInCta}
        </Link>
      </p>
    </>
  );
}

function PasswordMeter({ value }: { value: string }) {
  const score = !value ? 0 : Math.min(4, (value.length >= 8 ? 1 : 0) + (value.length >= 12 ? 1 : 0) + (/[A-Z]/.test(value) && /[a-z]/.test(value) ? 1 : 0) + (/\d|[^A-Za-z0-9]/.test(value) ? 1 : 0));
  const tone = score <= 1 ? "bg-signal" : score === 2 ? "bg-charcoal/60" : "bg-olive";
  return (
    <div className="mt-2.5 grid grid-cols-4 gap-1" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={`h-[3px] transition-colors ${i < Math.max(score, value ? 1 : 0) ? tone : "bg-charcoal/10"}`} />
      ))}
    </div>
  );
}
