"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ items }: { items: { href: string; label: string; badge?: number }[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Back office">
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3.5 text-[14px] transition-colors ${
              active ? "border-charcoal text-charcoal" : "border-transparent text-charcoal/55 hover:text-charcoal"
            }`}
          >
            {item.label}
            {!!item.badge && (
              <span className="grid h-5 min-w-5 place-items-center bg-signal px-1.5 font-display text-[11px] text-white" dir="ltr">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
