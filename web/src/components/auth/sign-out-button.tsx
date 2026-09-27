"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LoaderCircle, LogOut } from "lucide-react";

export function SignOutButton({ label, className = "" }: { label: string; className?: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        signOut({ callbackUrl: "/" });
      }}
      className={className}
    >
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="flip-rtl h-4 w-4" strokeWidth={1.5} />}
      {label}
    </button>
  );
}
