"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleCredentials(event: FormEvent) {
    event.preventDefault();
    setError("");
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    if (result?.error) {
      setError("Invalid email or password");
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-semibold">Sign in to 7-10 Store</h1>
        <p className="mt-2 text-center text-sm text-stone-600">
          Same account works on the website and syncs with Otargi inventory.
        </p>

        <form onSubmit={handleCredentials} className="mt-6 space-y-3">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border border-stone-300 px-3 py-2"
          />
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl border border-stone-300 px-3 py-2"
          />
          <button
            type="submit"
            className="w-full rounded-full bg-stone-900 px-6 py-3 text-white hover:bg-stone-800"
          >
            Sign in with email
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        <form
          className="mt-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await signIn("google", { callbackUrl: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-full border border-stone-300 px-6 py-3 hover:bg-stone-50"
          >
            Continue with Google
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-stone-600">
          No account?{" "}
          <Link href="/register" className="font-medium text-amber-600 underline">
            Register
          </Link>
        </p>
      </div>
    </main>
  );
}
