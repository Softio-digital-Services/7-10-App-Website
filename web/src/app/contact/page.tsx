"use client";

import { FormEvent, useState } from "react";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("Sending...");

    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, subject, message }),
    });

    if (!response.ok) {
      setStatus("Could not send message");
      return;
    }

    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
    setStatus("Message sent. We will reply by email.");
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Contact us</h1>
      <p className="mt-2 text-stone-600">
        Questions about orders, products, or wholesale? Send us a message.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
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
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full rounded-xl border border-stone-300 px-3 py-2"
        />
        <textarea
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Your message"
          className="min-h-32 w-full rounded-xl border border-stone-300 px-3 py-2"
        />
        <button type="submit" className="rounded-full bg-stone-900 px-6 py-3 text-white">
          Send message
        </button>
        {status && <p className="text-sm text-stone-600">{status}</p>}
      </form>
    </main>
  );
}
