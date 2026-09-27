"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { getSession, signIn } from "next-auth/react";
import { AlertTriangle, ArrowRight, LoaderCircle } from "lucide-react";
import { PasswordInput } from "@/components/auth/password-input";
import { describedBy, Field } from "@/components/form-field";
import { useI18n } from "@/components/i18n-provider";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function LoginForm({ callbackUrl, explicitCallback, google }: { callbackUrl: string; explicitCallback: boolean; google: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = {
      email: EMAIL_RE.test(email.trim()) ? undefined : t.auth.errEmail,
      password: password ? undefined : t.auth.enterPassword,
    };
    setErrors(found);
    setFailed(false);
    if (found.email || found.password) {
      formRef.current?.querySelector<HTMLElement>(found.email ? "#li-email" : "#li-password")?.focus();
      return;
    }
    setPending(true);
    const result = await signIn("credentials", { email: email.trim(), password, redirect: false });
    if (!result || result.error) {
      setPending(false);
      setFailed(true);
      return;
    }
    let target = callbackUrl;
    if (!explicitCallback) {
      const session = await getSession();
      if (session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER") target = "/admin";
    }
    router.replace(target);
    router.refresh();
  }

  const registerHref = explicitCallback ? `/register?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/register";

  return (
    <>
      <form ref={formRef} onSubmit={submit} noValidate className="space-y-6">
        {failed && (
          <div role="alert" className="flex items-start gap-3 border border-signal/40 bg-signal/5 px-5 py-4 text-[14px]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
            {t.auth.invalid}
          </div>
        )}
        <Field id="li-email" label={t.auth.email} error={errors.email}>
          <input
            id="li-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            className="field text-left"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            aria-describedby={describedBy("li-email", errors.email)}
          />
        </Field>
        <Field id="li-password" label={t.auth.password} error={errors.password}>
          <PasswordInput
            id="li-password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
            aria-describedby={describedBy("li-password", errors.password)}
          />
        </Field>
        <button type="submit" disabled={pending} className="btn btn-primary w-full">
          {pending ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" /> {t.auth.signingIn}
            </>
          ) : (
            <>
              {t.auth.signInCta} <ArrowRight className="flip-rtl h-4 w-4" />
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
        {t.auth.noAccount}{" "}
        <Link href={registerHref} className="font-medium text-charcoal underline underline-offset-4">
          {t.auth.createAccount}
        </Link>
      </p>
    </>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2-1.9 3.2-4.7 3.2-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.8 0-5.2-1.9-6.1-4.5H2.2v2.8A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.9 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8l3.7-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.1 1.6l3.1-3.1A11 11 0 0 0 2.2 7.1l3.7 2.8C6.8 7.3 9.2 5.4 12 5.4Z" />
    </svg>
  );
}
