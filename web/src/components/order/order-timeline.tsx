import { Check, X } from "lucide-react";
import { statusFlow } from "@/lib/order-status";

type OrderTimelineProps = {
  status: string;
  labels: Record<string, string>;
  tone?: "light" | "dark";
};

export function OrderTimeline({ status, labels, tone = "dark" }: OrderTimelineProps) {
  const cancelled = status === "CANCELLED";
  const current = cancelled ? 0 : Math.max(0, statusFlow.indexOf(status as (typeof statusFlow)[number]));
  const line = tone === "light" ? "bg-cream/20" : "bg-charcoal/15";
  const doneLine = tone === "light" ? "bg-cream" : "bg-charcoal";
  const muted = tone === "light" ? "text-cream/45" : "text-charcoal/40";

  return (
    <ol className="grid grid-cols-5 gap-0">
      {statusFlow.map((step, i) => {
        const done = !cancelled && i <= current;
        const active = !cancelled && i === current;
        return (
          <li key={step} className="relative flex flex-col items-center text-center">
            {i > 0 && (
              <span className={`absolute end-1/2 top-4 h-px w-full ${done ? doneLine : line}`} aria-hidden="true" />
            )}
            <span
              className={`relative z-[1] grid h-8 w-8 place-items-center rounded-full border text-[11px] transition-colors ${
                cancelled && i === 0
                  ? "border-signal bg-signal text-white"
                  : done
                    ? tone === "light"
                      ? "border-cream bg-cream text-olive"
                      : "border-charcoal bg-charcoal text-cream"
                    : tone === "light"
                      ? "border-cream/30 bg-olive text-cream/50"
                      : "border-charcoal/20 bg-cream text-charcoal/40"
              } ${active ? "ring-4 ring-signal/25" : ""}`}
            >
              {cancelled && i === 0 ? <X className="h-4 w-4" /> : done ? <Check className="h-4 w-4" /> : <span className="font-display">{i + 1}</span>}
            </span>
            <span className={`mt-3 px-1 text-[11.5px] leading-tight md:text-[12.5px] ${done || (cancelled && i === 0) ? "" : muted} ${active ? "font-medium" : ""}`}>
              {cancelled && i === 0 ? labels.CANCELLED : labels[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
