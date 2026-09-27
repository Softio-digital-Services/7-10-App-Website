"use client";

import { useI18n } from "@/components/i18n-provider";

export function LangSwitch({ className = "" }: { className?: string }) {
  const { locale, setLocale, switching } = useI18n();
  return (
    <div className={`inline-flex items-center border border-current/30 ${className}`} role="group" aria-label="Language">
      {(["en", "ar"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => l !== locale && setLocale(l)}
          disabled={switching}
          aria-pressed={locale === l}
          lang={l}
          className={`h-9 px-4 text-[13px] transition-colors ${
            locale === l ? "bg-cream text-charcoal" : "opacity-70 hover:opacity-100"
          }`}
        >
          {l === "en" ? "English" : "العربية"}
        </button>
      ))}
    </div>
  );
}
