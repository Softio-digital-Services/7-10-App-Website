"use client";

import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { isAppPage } from "@/components/layout/header";

/** Static service strip above the header. Phones get one line, and none on app-style pages. */
export function AnnouncementBar() {
  const { t } = useI18n();
  const pathname = usePathname();
  const items = [...t.design.announcement, t.design.announcementAr];

  return (
    <div className={`relative z-50 bg-forest text-cream ${isAppPage(pathname) ? "hidden lg:block" : ""}`}>
      <ul className="container-x flex h-8 items-center justify-center gap-10 overflow-hidden text-[12px] leading-none text-cream/90 md:h-9">
        <li className="whitespace-nowrap md:hidden">{items[0]} · {t.checkout.whish}</li>
        {items.map((item, i) => (
          <li key={item} lang={i === 3 ? (t.design.announcementAr === "Cash on delivery across Lebanon" ? "en" : "ar") : undefined} className={`hidden whitespace-nowrap ${i < 3 ? "md:block" : "xl:block"}`}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
