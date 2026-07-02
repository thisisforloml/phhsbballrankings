"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl border border-surface-200 bg-white p-8 shadow-sm">
      <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-orange-600">Admin Portal</p>
      <h1 className="mt-2 font-display text-3xl text-navy-900">Something went wrong</h1>
      <p className="mt-3 text-sm text-ink-600">
        An unexpected error occurred while loading this admin page. Your data was not changed by this screen.
      </p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-ink-500">Reference: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="border border-navy-900 bg-navy-900 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-white hover:bg-navy-800"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="border border-orange-600 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-orange-700 hover:bg-orange-50"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
