"use client";

import { PageBand } from "@/components/public/PageBand";
import { PublicPageShell } from "@/components/public/PublicPageShell";
import { SavedPlayersPanel } from "@/components/public/SavedPlayersPanel";

export default function SavedPlayersPage() {
  return (
    <PublicPageShell className="pb-12 pt-24">
      <PageBand eyebrow="Recruiting" title="Saved Players" />
      <section className="container-px py-8">
        <div className="mx-auto max-w-[42rem]">
          <SavedPlayersPanel />
        </div>
      </section>
    </PublicPageShell>
  );
}
