"use client";

import { useI18n } from "@/components/i18n-provider";
import { Marquee } from "@/components/marquee";
import { formatPrice } from "@/lib/format";
import { store } from "@/lib/store-config";

export function AnnouncementBar() {
  const { t, f } = useI18n();
  const items = t.announcement.map((line) =>
    f(line, { free: formatPrice(store.freeDeliveryOver), days: store.exchangeDays }),
  );

  return (
    <div className="relative z-50 bg-charcoal text-cream">
      <Marquee
        items={items}
        duration={44}
        className="h-9"
        itemClassName="eyebrow whitespace-nowrap leading-9 text-cream/85"
      />
    </div>
  );
}
