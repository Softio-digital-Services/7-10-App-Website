"use client";

// Replaces the root layout when it fails, so no providers, fonts or global CSS are available: plain styles only.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#f1eee4", color: "#1d1d16", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24 }}>
        <main>
          <h1 style={{ fontSize: 40, margin: 0 }}>Something broke</h1>
          <p style={{ marginTop: 12, opacity: 0.75 }} dir="rtl" lang="ar">حدث خلل. حاول مجدداً بعد لحظات.</p>
          <p style={{ opacity: 0.75 }}>We couldn&apos;t load the page. Please try again in a moment.</p>
          <button type="button" onClick={reset} style={{ marginTop: 20, padding: "12px 24px", background: "#1d1d16", color: "#f1eee4", border: 0, cursor: "pointer", fontSize: 15 }}>
            Try again · حاول مجدداً
          </button>
        </main>
      </body>
    </html>
  );
}
