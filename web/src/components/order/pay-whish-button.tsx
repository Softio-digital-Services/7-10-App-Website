"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

export function PayWhishButton({ orderNumber }: { orderNumber: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/whish/pay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (data?.payUrl) {
      window.location.href = data.payUrl;
      return;
    }
    if (data?.paid) {
      window.location.reload();
      return;
    }
    setBusy(false);
    setError(data?.error === "not_configured" ? t.checkout.errWhishSetup : t.common.somethingWrong);
  };

  return (
    <div className="mt-8">
      <button type="button" className="btn btn-primary" onClick={pay} disabled={busy}>
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        {busy ? t.checkout.openingWhish : t.checkout.payWhish}
      </button>
      {error ? <p className="mt-3 text-[13px] text-signal">{error}</p> : null}
    </div>
  );
}
