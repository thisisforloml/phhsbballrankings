"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

export function ClaimPageClient() {
  const router = useRouter();
  const params = useSearchParams();
  const playerSlug = params.get("player")?.trim() ?? "";

  function handleBack() {
    if (playerSlug) {
      router.push(`/players/${encodeURIComponent(playerSlug)}`);
      return;
    }
    router.back();
  }

  return (
    <main className="bg-surface-50 pb-24">
      <section className="hero-brand pt-32 text-white">
        <div className="container-px py-14">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Profile Claim</p>
          <h1 className="mt-3 font-display text-stat-lg">Claim Profile</h1>
          <p className="mt-4 max-w-2xl text-white/70">
            This feature is currently under development and will be available in a future Peach Basket update.
          </p>
        </div>
      </section>

      <section className="container-px pt-10">
        <article className="mx-auto max-w-2xl rounded-lg border border-surface-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap gap-3">
            {playerSlug ? (
              <Link
                href={`/players/${encodeURIComponent(playerSlug)}`}
                className="inline-flex items-center justify-center rounded-md bg-court-900 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:bg-court-800"
              >
                Back to Player Profile
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center justify-center rounded-md bg-court-900 px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-white transition hover:bg-court-800"
              >
                Back to Player Profile
              </button>
            )}
            <Link
              href="/rankings"
              className="inline-flex items-center justify-center rounded-md border border-line-500 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-court-900 transition hover:border-hardwood-600 hover:text-hardwood-600"
            >
              Browse Rankings
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
