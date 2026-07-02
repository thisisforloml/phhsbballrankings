import type { Metadata } from "next";
import { Suspense } from "react";

import { ClaimPageClient } from "./ClaimPageClient";

export const metadata: Metadata = {
  title: "Claim Your Profile",
  description: "Submit a profile claim for admin review on Peach Basket Rankings PH.",
};

function ClaimPageFallback() {
  return (
    <main className="bg-surface-50 pb-24">
      <section className="hero-brand pt-32 text-white">
        <div className="container-px py-14">
          <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Profile Claim</p>
          <h1 className="mt-3 font-display text-stat-lg">Claim Your Profile</h1>
          <p className="mt-4 max-w-2xl text-white/70">Loading claim form…</p>
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
