"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { Marquee } from "@/components/marquee";
import { formatPrice } from "@/lib/format";
import { launchStamp, store } from "@/lib/store-config";

export function AnnouncementBar() {
  const { t, f } = useI18n();
  // Moving text must be stoppable (WCAG 2.2.2); hover only covers mouse users.
  const [paused, setPaused] = useState(false);
  const items = t.announcement.map((line) =>
    f(line, { free: formatPrice(store.freeDeliveryOver), days: store.exchangeDays, launch: launchStamp() }),
  );

  return (
    <div className="relative z-50 flex bg-charcoal text-cream">
      <Marquee
        items={items}
        duration={44}
        paused={paused}
        className="h-9 min-w-0 flex-1"
        itemClassName="eyebrow whitespace-nowrap leading-9 text-cream/85"
      />
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? t.common.playTicker : t.common.pauseTicker}
        className="grid h-9 w-9 shrink-0 place-items-center border-s border-cream/15 text-cream/70 hover:text-cream"
      >
        {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
      </button>
    </div>
  );
}
