"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Check, LoaderCircle, Send } from "lucide-react";
import { describedBy, Field } from "@/components/form-field";
import { useI18n } from "@/components/i18n-provider";

type Form = { name: string; email: string; message: string };
type Errors = Partial<Record<keyof Form, string>>;
const order: (keyof Form)[] = ["name", "email", "message"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ContactForm({ account }: { account: { name: string; email: string } | null }) {
  const { t } = useI18n();
  const [form, setForm] = useState<Form>({ name: account?.name ?? "", email: account?.email ?? "", message: "" });
  const [topic, setTopic] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof Form, boolean>>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const formRef = useRef<HTMLFormElement>(null);

  function validate(values: Form): Errors {
    const next: Errors = {};
    if (values.name.trim().length < 2) next.name = t.contact.errName;
    if (!EMAIL_RE.test(values.email.trim())) next.email = t.contact.errEmail;
    if (values.message.trim().length < 10) next.message = t.contact.errMessage;
    return next;
  }

  function update(key: keyof Form, value: string) {
    const next = { ...form, [key]: value };
    setForm(next);
    if (touched[key]) setErrors((e) => ({ ...e, [key]: validate(next)[key] }));
  }

  function blur(key: keyof Form) {
    setTouched((s) => ({ ...s, [key]: true }));
    setErrors((e) => ({ ...e, [key]: validate(form)[key] }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    setTouched({ name: true, email: true, message: true });
    const first = order.find((k) => found[k]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`#ct-${first}`)?.focus();
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, subject: t.contact.topics[topic] }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  function reset() {
    setForm((f) => ({ ...f, message: "" }));
    setTouched({});
    setErrors({});
    setStatus("idle");
  }

  if (status === "sent") {
    return (
      <div className="flex min-h-[420px] flex-col items-start justify-center border border-charcoal/15 p-8 md:p-12" role="status">
        <span className="grid h-14 w-14 place-items-center bg-olive text-cream">
          <Check className="h-7 w-7" strokeWidth={1.75} />
        </span>
        <p className="display mt-8 text-4xl md:text-5xl">{t.contact.sentTitle}</p>
        <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-charcoal/70">{t.contact.sent}</p>
        <button type="button" onClick={reset} className="btn btn-outline mt-9">
          {t.contact.sendAnother}
        </button>
      </div>
    );
  }

  const sending = status === "sending";

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-7">
      <fieldset>
        <legend className="field-label">{t.contact.topicLabel}</legend>
        <div className="flex flex-wrap gap-2">
          {t.contact.topics.map((label, i) => (
            <label
              key={label}
              className={`cursor-pointer border px-4 py-2.5 text-[14px] transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-olive ${
                topic === i ? "border-charcoal bg-charcoal text-cream" : "border-charcoal/20 hover:border-charcoal"
              }`}
            >
              <input type="radio" name="topic" className="sr-only" checked={topic === i} onChange={() => setTopic(i)} />
              {label}
            </label>
          ))}
        </div>
        {topic === 0 && <p className="mt-2.5 text-[13px] text-charcoal/55">{t.contact.orderHint}</p>}
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="ct-name" label={t.contact.name} error={errors.name}>
          <input
            id="ct-name"
            className="field"
            autoComplete="name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            onBlur={() => blur("name")}
            aria-invalid={!!errors.name}
            aria-describedby={describedBy("ct-name", errors.name)}
          />
        </Field>
        <Field id="ct-email" label={t.contact.email} error={errors.email}>
          <input
            id="ct-email"
            type="email"
            inputMode="email"
            dir="ltr"
            className="field text-start"
            autoComplete="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            onBlur={() => blur("email")}
            aria-invalid={!!errors.email}
            aria-describedby={describedBy("ct-email", errors.email)}
          />
        </Field>
      </div>

      <Field
        id="ct-message"
        label={t.contact.message}
        error={errors.message}
        aside={
          <span className="font-display text-[11px] tabular-nums text-charcoal/40" dir="ltr">
            {form.message.length}/5000
          </span>
        }
      >
        <textarea
          id="ct-message"
          className="field min-h-44 resize-y py-3.5"
          maxLength={5000}
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
          onBlur={() => blur("message")}
          aria-invalid={!!errors.message}
          aria-describedby={describedBy("ct-message", errors.message)}
        />
      </Field>

      {status === "error" && (
        <div role="alert" className="flex items-start gap-3 border border-signal/40 bg-signal/5 px-5 py-4 text-[14px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
          {t.contact.error}
        </div>
      )}

      <button type="submit" disabled={sending} className="btn btn-primary w-full sm:w-auto">
        {sending ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" /> {t.contact.sending}
          </>
        ) : (
          <>
            {t.contact.send} <Send className="flip-rtl h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
