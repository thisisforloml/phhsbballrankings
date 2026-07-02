"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/monitoring/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest ?? null,
        stack: process.env.NODE_ENV === "development" ? error.stack ?? null : null,
      }),
      keepalive: true,
    }).catch(() => {
      // Best-effort client error reporting.
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-surface-50 font-sans text-navy-900">
        <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-orange-600">Peach Basket</p>
          <h1 className="mt-3 font-display text-3xl">Something went wrong</h1>
          <p className="mt-3 text-sm text-ink-600">
            An unexpected error occurred. You can try again or return to the homepage.
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-xs text-ink-500">Reference: {error.digest}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="border border-navy-900 bg-navy-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Try again
            </button>
            <a href="/" className="border border-orange-600 px-4 py-2 text-sm font-semibold text-orange-700">
              Go home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
