"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";
import { whatsappLink } from "@/lib/store-config";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="container-x flex min-h-[70svh] flex-col items-center justify-center py-20 text-center" role="alert">
      <span className="h-0 w-0 border-x-[22px] border-t-[36px] border-x-transparent border-t-signal" aria-hidden="true" />
      <h1 className="display mt-8 text-5xl md:text-7xl">{t.error.title}</h1>
      <p className="mx-auto mt-4 max-w-md text-[16px] leading-relaxed text-charcoal/70">{t.error.body}</p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          <RotateCcw className="h-4 w-4" /> {t.error.retry}
        </button>
        <a href={whatsappLink()} target="_blank" rel="noreferrer" className="btn btn-outline">
          <WhatsAppIcon className="h-4 w-4" /> {t.error.whatsapp}
        </a>
      </div>
      {error.digest && (
        <p className="mt-8 font-mono text-[12px] text-charcoal/65" dir="ltr">
          ref {error.digest}
        </p>
      )}
    </section>
  );
}
