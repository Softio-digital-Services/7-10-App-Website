"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
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
      body: JSON.stringify({ contact, locale }),
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  }

  const light = tone === "light";

  if (state === "done") {
    return (
      <p className={`flex items-center gap-3 ${compact ? "py-3" : "py-4"} ${light ? "text-cream" : "text-charcoal"}`} role="status">
        <span className="grid h-8 w-8 place-items-center bg-signal text-white">
          <Check className="h-4 w-4" />
        </span>
        {t.home.joinDone}
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div
        className={`flex items-stretch border-b ${light ? "border-cream/40 focus-within:border-cream" : "border-charcoal/30 focus-within:border-charcoal"} transition-colors`}
      >
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (state === "error") setState("idle");
          }}
          placeholder={t.home.joinPlaceholder}
          aria-label={t.home.joinPlaceholder}
          aria-invalid={state === "error"}
          className={`min-w-0 flex-1 bg-transparent py-4 text-[15px] focus:outline-none ${
            light ? "placeholder:text-cream/50" : "placeholder:text-charcoal/40"
          }`}
        />
        <button
          type="submit"
          disabled={state === "loading"}
          className={`group flex shrink-0 items-center gap-3 ps-4 eyebrow ${light ? "text-cream" : "text-charcoal"} disabled:opacity-50`}
        >
          {t.home.joinCta}
          <ArrowRight className="flip-rtl h-4 w-4 transition-transform duration-500 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
        </button>
      </div>
      {state === "error" && <p className="mt-2 text-[13px] text-signal">{t.home.joinInvalid}</p>}
    </form>
  );
}
