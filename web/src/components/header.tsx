import Link from "next/link";
import { ShoppingBag, User } from "lucide-react";
import { auth, signOut } from "@/lib/auth";

export async function Header() {
  const session = await auth();

  return (
    <header className="border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-xl font-semibold tracking-tight text-stone-900">
          7-10 <span className="text-amber-500">Store</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm text-stone-600">
          <Link href="/" className="hover:text-stone-900">
            Shop
          </Link>
          <Link href="/contact" className="hover:text-stone-900">
            Contact
          </Link>
          <Link href="/orders" className="hover:text-stone-900">
            Orders
          </Link>
          <Link href="/cart" className="flex items-center gap-1 hover:text-stone-900">
            <ShoppingBag className="h-4 w-4" />
            Cart
          </Link>
          {(session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER") && (
            <Link href="/manager" className="hover:text-stone-900">
              Manager
            </Link>
          )}
          {session?.user?.role === "ADMIN" && (
            <Link href="/admin" className="hover:text-stone-900">
              Admin
            </Link>
          )}
          {session ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="flex items-center gap-1 rounded-full border border-stone-300 px-3 py-1.5 hover:bg-stone-50"
              >
                <User className="h-4 w-4" />
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-stone-900 px-3 py-1.5 text-white hover:bg-stone-800"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
