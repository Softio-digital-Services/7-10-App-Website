"use client";

import { usePathname } from "next/navigation";
import { isAppPage, stripLocale } from "@/components/layout/header";

/**
 * Picks the footer per page, as in the design:
 * home gets the full footer everywhere; app-style pages get the slim one on desktop and none on phones;
 * other pages get the full one on phones and the slim one on desktop.
 */
export function FooterSwitch({ full, slim }: { full: React.ReactNode; slim: React.ReactNode }) {
  const pathname = stripLocale(usePathname());
  if (pathname === "/") return <>{full}</>;
  if (isAppPage(pathname)) return <div className="hidden lg:block">{slim}</div>;
  return (
    <>
      <div className="lg:hidden">{full}</div>
      <div className="hidden lg:block">{slim}</div>
    </>
  );
}
