"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";

export function MessageActions({ id, read, email, subject }: { id: string; read: boolean; email: string; subject: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isRead, setIsRead] = useState(read);

  async function toggle(next: boolean) {
    setIsRead(next);
    const res = await fetch("/api/admin/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: next }),
    });
    if (!res.ok) setIsRead(!next);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`mailto:${email}?subject=${encodeURIComponent(`Re: ${subject || "Your message to 7.10"}`)}`}
        onClick={() => !isRead && toggle(true)}
        className="btn btn-primary btn-sm"
      >
        <Mail className="h-4 w-4" strokeWidth={1.5} /> Reply
      </a>
      <button type="button" disabled={pending} onClick={() => toggle(!isRead)} className="btn btn-outline btn-sm">
        {isRead ? "Mark unread" : "Mark read"}
      </button>
    </div>
  );
}
