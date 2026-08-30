"use client";

import { FormEvent, useEffect, useState } from "react";

type Comment = {
  id: string;
  authorName: string;
  authorEmail: string;
  content: string;
  reply: string | null;
  product: { name: string };
};

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/comments")
      .then((res) => res.json())
      .then(setComments)
      .catch(() => setMessage("Could not load comments"));
  }, []);

  async function handleReply(event: FormEvent, commentId: string) {
    event.preventDefault();
    const reply = replyDrafts[commentId];
    if (!reply) return;

    const response = await fetch("/api/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId, reply }),
    });

    if (!response.ok) {
      setMessage("Reply failed");
      return;
    }

    const updated = await response.json();
    setComments((current) =>
      current.map((comment) => (comment.id === updated.id ? updated : comment)),
    );
    setMessage("Reply sent by email.");
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Comment replies</h1>
      {message && <p className="mt-2 text-sm text-stone-600">{message}</p>}

      <div className="mt-8 space-y-4">
        {comments.map((comment) => (
          <article key={comment.id} className="rounded-2xl border border-stone-200 bg-white p-5">
            <p className="text-sm text-stone-500">{comment.product.name}</p>
            <p className="mt-1 font-medium">
              {comment.authorName} ({comment.authorEmail})
            </p>
            <p className="mt-2 text-stone-700">{comment.content}</p>

            {comment.reply ? (
              <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm">
                Replied: {comment.reply}
              </p>
            ) : (
              <form onSubmit={(e) => handleReply(e, comment.id)} className="mt-4 space-y-2">
                <textarea
                  value={replyDrafts[comment.id] ?? ""}
                  onChange={(e) =>
                    setReplyDrafts((current) => ({
                      ...current,
                      [comment.id]: e.target.value,
                    }))
                  }
                  placeholder="Write a reply"
                  className="min-h-20 w-full rounded-xl border border-stone-300 px-3 py-2"
                />
                <button
                  type="submit"
                  className="rounded-full bg-stone-900 px-4 py-2 text-sm text-white"
                >
                  Send reply
                </button>
              </form>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
