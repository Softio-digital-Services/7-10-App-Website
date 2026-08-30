"use client";

import { FormEvent, useState } from "react";

type Comment = {
  id: string;
  authorName: string;
  content: string;
  reply: string | null;
  createdAt: string;
};

type CommentSectionProps = {
  productId: string;
  initialComments: Comment[];
};

export function CommentSection({ productId, initialComments }: CommentSectionProps) {
  const [comments, setComments] = useState(initialComments);
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("Sending...");

    const response = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, authorName, authorEmail, content }),
    });

    if (!response.ok) {
      setStatus("Could not post comment");
      return;
    }

    const comment = await response.json();
    setComments((current) => [comment, ...current]);
    setContent("");
    setStatus("Comment posted. The store was emailed.");
  }

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Comments</h2>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            required
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Your name"
            className="rounded-xl border border-stone-300 px-3 py-2"
          />
          <input
            required
            type="email"
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            placeholder="Your email"
            className="rounded-xl border border-stone-300 px-3 py-2"
          />
        </div>
        <textarea
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Ask a question or leave a review"
          className="min-h-24 w-full rounded-xl border border-stone-300 px-3 py-2"
        />
        <button
          type="submit"
          className="rounded-full bg-stone-900 px-4 py-2 text-sm text-white"
        >
          Post comment
        </button>
        {status && <p className="text-sm text-stone-600">{status}</p>}
      </form>

      <div className="space-y-4">
        {comments.map((comment) => (
          <article key={comment.id} className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="font-medium">{comment.authorName}</p>
            <p className="mt-2 text-stone-700">{comment.content}</p>
            {comment.reply && (
              <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm text-stone-600">
                Store reply: {comment.reply}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
