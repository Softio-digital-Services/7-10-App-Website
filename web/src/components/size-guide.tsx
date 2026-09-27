"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { WhatsAppIcon } from "@/components/icons";
import { useLockBody } from "@/components/use-lock-body";
import { whatsappLink } from "@/lib/store-config";

export type SizeChart = "tops" | "bottoms";

const tops = [
  ["S", "92–96", "69", "61"],
  ["M", "97–102", "71", "62"],
  ["L", "103–108", "73", "63"],
  ["XL", "109–114", "75", "64"],
  ["XXL", "115–120", "77", "65"],
];

const bottoms = [
  ["28", "71–73", "88–90", "78"],
  ["30", "76–78", "93–95", "79"],
  ["32", "81–83", "98–100", "80"],
  ["34", "86–88", "103–105", "81"],
  ["36", "91–93", "108–110", "81"],
];

export function chartFor(categorySlug: string): SizeChart {
  return /bottom|pant|jean|short|trouser/.test(categorySlug) ? "bottoms" : "tops";
}

export function SizeGuideContent({ initial = "tops", highlight }: { initial?: SizeChart; highlight?: string }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<SizeChart>(initial);
  const g = t.sizeGuide;
  const head = tab === "tops" ? [g.size, g.chest, g.length, g.sleeve] : [g.size, g.waist, g.hip, g.inseam];
  const rows = tab === "tops" ? tops : bottoms;

  return (
    <div>
      <p className="text-[14.5px] leading-relaxed text-charcoal/70">{g.intro}</p>

      <div className="mt-6 inline-flex border border-charcoal/20" role="tablist">
        {(["tops", "bottoms"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`h-10 px-5 text-[13.5px] transition-colors ${tab === key ? "bg-charcoal text-cream" : "hover:bg-charcoal/5"}`}
          >
            {key === "tops" ? g.tops : g.bottoms}
          </button>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[360px] border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-charcoal">
              {head.map((h, i) => (
                <th key={h} className={`eyebrow py-3 text-[10.5px] font-normal text-charcoal/60 ${i === 0 ? "text-start" : "text-center"}`}>
                  {h}
                  {i > 0 && <span className="ms-1 normal-case tracking-normal">(cm)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const active = highlight && row[0].toUpperCase() === highlight.toUpperCase();
              return (
                <tr key={row[0]} className={`border-b border-charcoal/10 ${active ? "bg-olive/10" : ""}`}>
                  {row.map((cell, i) => (
                    <td key={i} className={`py-3.5 tabular-nums ${i === 0 ? "font-display text-[15px] font-medium" : "text-center text-charcoal/80"}`} dir="ltr">
                      {cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-8 bg-cream-2 p-5">
        <p className="eyebrow text-[10.5px] text-charcoal/60">{g.howTo}</p>
        <ul className="mt-3 space-y-1.5 text-[14px] text-charcoal/75">
          {(tab === "tops" ? [g.howChest] : [g.howWaist, g.howHip, g.howInseam]).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <a href={whatsappLink()} target="_blank" rel="noreferrer" className="mt-6 flex items-center gap-3 text-[14px] underline-offset-4 hover:underline">
        <WhatsAppIcon className="h-5 w-5 text-[#25D366]" />
        {g.help}
      </a>
    </div>
  );
}

export function SizeGuideDialog({ open, onClose, initial, highlight }: { open: boolean; onClose: () => void; initial: SizeChart; highlight?: string }) {
  const { t } = useI18n();
  useLockBody(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-[80] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
      inert={!open}
      role="dialog"
      aria-modal="true"
      aria-label={t.sizeGuide.title}
    >
      <div className={`absolute inset-0 bg-charcoal/50 transition-opacity duration-500 ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div
        className={`absolute inset-y-0 end-0 flex w-full max-w-[520px] flex-col bg-cream transition-transform duration-700 ease-[var(--ease-out-expo)] ${
          open ? "translate-x-0" : "translate-x-full rtl:-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-charcoal/10 px-6 md:h-[76px]">
          <p className="display text-2xl">{t.sizeGuide.title}</p>
          <button type="button" onClick={onClose} className="-me-2 grid h-11 w-11 place-items-center" aria-label={t.common.close}>
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{open && <SizeGuideContent initial={initial} highlight={highlight} />}</div>
      </div>
    </div>
  );
}
