"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function DeviceActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function revoke() {
    if (!confirm(`Unlink "${name}"? It stops syncing immediately. It can be linked again from its Settings.`)) return;
    const res = await fetch("/api/admin/devices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) alert("Couldn't unlink this laptop. Try again.");
    startTransition(() => router.refresh());
  }

  return (
    <button type="button" disabled={pending} onClick={revoke} className="btn btn-outline btn-sm">
      Unlink
    </button>
  );
}
