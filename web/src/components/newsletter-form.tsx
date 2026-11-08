"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Honeypot, honeypotValue } from "@/components/honeypot";
import { useI18n } from "@/components/i18n-provider";

export function NewsletterForm({ tone = "light", compact = false }: { tone?: "light" | "dark"; compact?: boolean }) {
  const { t, locale } = useI18n();
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const contact = value.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
    const isPhone = contact.replace(/\D/g, "").length >= 7;
    if (!isEmail && !isPhone) {
      setState("error");
      return;
    }
    setState("loading");
    const res = await fetch("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact, locale, website: honeypotValue(e.currentTarget as HTMLFormElement) }),
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  }

  const light = tone === "light";

  if (state === "done") {
    return (
      <p className={`flex items-center gap-3 ${compact ? "py-3" : "py-4"} ${light ? "text-cream" : "text-charcoal"}`} role="status">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-signal text-white">
          <Check className="h-4 w-4" />
        </span>
        {t.home.joinDone}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="relative">
      <Honeypot />
      <div className="flex items-stretch gap-2">
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (state === "error") setState("idle");
          }}
          placeholder={compact ? "name@example.com" : t.home.joinPlaceholder}
          aria-label={t.home.joinPlaceholder}
          aria-invalid={state === "error"}
          className={`min-w-0 flex-1 rounded border px-3.5 ${compact ? "h-11" : "h-12"} text-[15px] transition-colors focus:outline-none ${
            light
              ? "border-cream/30 bg-black/15 text-cream placeholder:text-cream/50 focus:border-cream"
              : "border-charcoal/40 bg-white placeholder:text-charcoal/45 focus:border-charcoal"
          }`}
        />
        <button type="submit" disabled={state === "loading"} className={`btn btn-primary shrink-0 ${compact ? "min-h-11 px-4" : ""}`}>
          {compact ? t.design.footer.signUp : t.home.joinCta}
          {!compact && <ArrowRight className="flip-rtl h-4 w-4" />}
        </button>
      </div>
      {state === "error" && <p className={`mt-2 text-[13px] ${light ? "text-cream" : "text-signal-ink"}`}>{t.home.joinInvalid}</p>}
    </form>
  );
}
