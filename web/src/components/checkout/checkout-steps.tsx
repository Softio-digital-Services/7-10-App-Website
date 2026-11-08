"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import type { CartItem } from "@/types/store";
import { formatPrice } from "@/lib/format";

/** Cart → Delivery and payment → Confirmation. Numbered circles on desktop, three bars on phones. */
export function CheckoutSteps({ current }: { current: 1 | 2 | 3 }) {
  const { t } = useI18n();
  const hrefs = ["/cart", "/checkout", null];

  return (
    <>
      <div className="grid grid-cols-3 gap-2 lg:hidden" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className="h-1.5 overflow-hidden rounded-full bg-sand">
            {n <= current && <span className="fill-in block h-full rounded-full bg-charcoal" style={{ animationDelay: `${(n - 1) * 0.15}s` }} />}
          </span>
        ))}
      </div>
      <ol className="hidden items-center gap-3 text-[14px] lg:flex" aria-label={t.ui.steps.join(", ")}>
        {t.ui.steps.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const on = n === current;
          const href = hrefs[i];
          const circle = (
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                done || on ? "bg-charcoal text-white" : "border border-charcoal/50 text-charcoal/70"
              }`}
            >
              {done ? <Check className="pop h-3.5 w-3.5" strokeWidth={3} /> : n}
            </span>
          );
          return (
            <li key={label} className="flex items-center gap-3" aria-current={on ? "step" : undefined}>
              {done && href ? (
                <Link href={href} className="flex items-center gap-2 underline underline-offset-4">
                  {circle}
                  {label}
                </Link>
              ) : (
                <span className={`flex items-center gap-2 ${on ? "font-bold" : "text-charcoal/75"}`}>
                  {circle}
                  {label}
                </span>
              )}
              {n < 3 && <span className={`h-px w-14 ${done ? "bg-charcoal" : "bg-charcoal/25"}`} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </>
  );
}

/** Plain-text order for a WhatsApp message. */
export function orderMessage(intro: string, items: CartItem[], lines: string[] = []) {
  const rows = items.map((i) => `• ${i.productName} — ${i.size} × ${i.quantity} — ${formatPrice(i.price * i.quantity)}`);
  return [intro, ...rows, ...lines].join("\n");
}
