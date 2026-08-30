"use client";

import { FormEvent, useEffect, useState } from "react";

type Request = {
  id: string;
  message: string;
  response: string | null;
  status: string;
  product: { name: string };
  member: { name: string | null; email: string };
};

export default function ManagerPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/requests")
      .then((res) => res.json())
      .then(setRequests)
      .catch(() => setMessage("Could not load requests"));
  }, []);

  async function handleReply(event: FormEvent, requestId: string) {
    event.preventDefault();
    const response = await fetch("/api/requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, response: replies[requestId] }),
    });

    if (!response.ok) {
      setMessage("Reply failed");
      return;
    }

    const updated = await response.json();
    setRequests((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    setMessage("Reply sent by email.");
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Manager dashboard</h1>
      <p className="mt-2 text-stone-600">
        Review customer product requests and reply by email — like BTB manager workflow.
      </p>
      {message && <p className="mt-2 text-sm text-stone-600">{message}</p>}

      <div className="mt-8 space-y-4">
        {requests.map((request) => (
          <article key={request.id} className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-sm text-amber-600">{request.product.name}</p>
            <p className="mt-1 font-medium">
              {request.member.name} ({request.member.email})
            </p>
            <p className="mt-2 text-stone-700">{request.message}</p>
            {request.response ? (
              <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm">
                Replied: {request.response}
              </p>
            ) : (
              <form onSubmit={(e) => handleReply(e, request.id)} className="mt-4 space-y-2">
                <textarea
                  required
                  value={replies[request.id] ?? ""}
                  onChange={(e) =>
                    setReplies((current) => ({ ...current, [request.id]: e.target.value }))
                  }
                  className="min-h-20 w-full rounded-xl border border-stone-300 px-3 py-2"
                  placeholder="Write a reply to the customer"
                />
                <button
                  type="submit"
                  className="rounded-full bg-amber-500 px-4 py-2 text-sm text-white"
                >
                  Send reply
                </button>
              </form>
            )}
          </article>
        ))}
        {requests.length === 0 && (
          <p className="text-stone-600">No product requests yet.</p>
        )}
      </div>
    </main>
  );
}
