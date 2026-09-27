import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/admin-nav";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireStaff } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Back office", robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStaff();
  if (!session) redirect("/login?callbackUrl=/admin");

  const [pending, unread] = await Promise.all([
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.contactMessage.count({ where: { read: false } }),
  ]);

  return (
    <div className="pb-24">
      <div className="border-b border-charcoal/15 bg-cream-2/60">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-4 pt-8">
            <div>
              <p className="eyebrow flex items-center gap-3 text-charcoal/55">
                <span className="dot-signal" /> 7.10 — {session.user.role === "ADMIN" ? "Admin" : "Manager"}
              </p>
              <p className="display mt-2 text-4xl md:text-5xl">Back office</p>
            </div>
            <SignOutButton label="Sign out" className="btn btn-outline btn-sm" />
          </div>
          <div className="mt-6">
            <AdminNav
              items={[
                { href: "/admin", label: "Overview" },
                { href: "/admin/orders", label: "Orders", badge: pending },
                { href: "/admin/inventory", label: "Inventory" },
                { href: "/admin/messages", label: "Messages", badge: unread },
                { href: "/admin/laptops", label: "Laptops" },
              ]}
            />
          </div>
        </div>
      </div>
      <div className="container-x pt-10">{children}</div>
    </div>
  );
}
