"use client";

import { AlertTriangle, X } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { useI18n } from "@/components/i18n-provider";

/** Lists bag lines a stock check removed or reduced, so nothing disappears without a word. */
export function StockNotice({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const { stockNotice, dismissStockNotice } = useCart();
  if (!stockNotice.length) return null;

  return (
    <div role="status" className={`flex items-start gap-3 bg-signal/10 p-4 text-[13.5px] ${className}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-signal-ink" />
      <div className="min-w-0 flex-1">
        <p>{t.bag.stockChanged}</p>
        <ul className="mt-1 list-inside list-disc text-charcoal/75">
          {stockNotice.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <button type="button" onClick={dismissStockNotice} className="-m-2 grid h-9 w-9 shrink-0 place-items-center" aria-label={t.common.close}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
