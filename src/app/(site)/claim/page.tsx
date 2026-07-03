import type { Metadata } from "next";
import { Suspense } from "react";

import { ClaimPageClient } from "./ClaimPageClient";

export const metadata: Metadata = {
  title: "Claim Profile",
  description:
    "Claim Profile is under development and will be available in a future Peach Basket update.",
};

function ClaimPageFallback() {
  return (
    <main className="bg-surface-50 pb-24">
      <section className="hero-brand pt-32 text-white">
        <div className="container-px py-14">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Profile Claim</p>
          <h1 className="mt-3 font-display text-stat-lg">Claim Profile</h1>
          <p className="mt-4 max-w-2xl text-white/70">Loading…</p>
        </div>
      </section>
    </main>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={<ClaimPageFallback />}>
      <ClaimPageClient />
    </Suspense>
  );
}
