"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";

type Parts = { d: number; h: number; m: number; s: number };

function partsUntil(target: number): Parts | null {
  const diff = target - Date.now();
  if (diff <= 0) return null;
  return {
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff / 3_600_000) % 24),
    m: Math.floor((diff / 60_000) % 60),
    s: Math.floor((diff / 1000) % 60),
  };
}

export function Countdown({ target, tone = "light", onDone }: { target: string; tone?: "light" | "dark"; onDone?: () => void }) {
  const { t } = useI18n();
  const [parts, setParts] = useState<Parts | null | undefined>(undefined);

  useEffect(() => {
    const ts = new Date(target).getTime();
    const tick = () => {
      const next = partsUntil(ts);
      setParts(next);
      if (!next) onDone?.();
      return next;
    };
    if (!tick()) return;
    const id = setInterval(() => {
      if (!tick()) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [target, onDone]);

  if (parts === null) return null;

  const cells = [
    { value: parts?.d, label: t.home.days, en: "Days" },
    { value: parts?.h, label: t.home.hours, en: "Hrs" },
    { value: parts?.m, label: t.home.minutes, en: "Min" },
    { value: parts?.s, label: t.home.seconds, en: "Sec" },
  ];

  const border = tone === "light" ? "border-cream/20 divide-cream/20" : "border-charcoal/15 divide-charcoal/15";
  const muted = tone === "light" ? "text-cream/70" : "text-charcoal/60";
  const faint = tone === "light" ? "text-cream/40" : "text-charcoal/40";

  return (
    <div className={`grid w-full max-w-md grid-cols-4 divide-x rtl:divide-x-reverse border ${border}`} role="timer" aria-live="off">
      {cells.map((c) => (
        <div key={c.en} className="flex flex-col items-center gap-1 px-2 py-4 md:py-5">
          <span className="font-display text-3xl font-medium tabular-nums leading-none md:text-4xl" dir="ltr">
            {c.value === undefined ? "--" : String(c.value).padStart(2, "0")}
          </span>
          <span className={`text-[11px] ${muted}`}>{c.label}</span>
          <span className={`font-display text-[9px] uppercase keep-tracking tracking-[0.3em] ${faint}`}>{c.en}</span>
        </div>
      ))}
    </div>
  );
}
