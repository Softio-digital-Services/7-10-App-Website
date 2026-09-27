"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { WhatsAppIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";
import { whatsappLink } from "@/lib/store-config";

export function WhatsAppFab() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (pathname.startsWith("/checkout") || pathname.startsWith("/admin")) return null;
  const onProduct = pathname.startsWith("/products/");

  return (
    <a
      href={whatsappLink()}
      target="_blank"
      rel="noreferrer"
      aria-label={t.help.chat}
      className={`group fixed end-4 z-30 flex h-12 items-center gap-0 overflow-hidden bg-charcoal text-cream shadow-lg transition-all duration-500 md:end-6 md:bottom-6 ${
        onProduct ? "bottom-24" : "bottom-4"
      } ${visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}
    >
      <span className="grid h-12 w-12 place-items-center">
        <WhatsAppIcon className="h-5 w-5" />
      </span>
      <span className="max-w-0 whitespace-nowrap text-[13px] transition-[max-width,padding] duration-500 group-hover:max-w-48 group-hover:pe-4">
        {t.help.chat}
      </span>
    </a>
  );
}
