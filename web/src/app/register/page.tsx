"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      setError(typeof data.error === "string" ? data.error : "Registration failed");
      return;
    }

    router.push("/login");
  }

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-semibold">Create account</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-xl border border-stone-300 px-3 py-2"
          />
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
            minLength={6}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 chars)"
            className="w-full rounded-xl border border-stone-300 px-3 py-2"
          />
          <button
            type="submit"
            className="w-full rounded-full bg-amber-500 px-6 py-3 font-medium text-white"
          >
            Register
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>
        <p className="mt-6 text-center text-sm text-stone-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-amber-600 underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
