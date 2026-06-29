"use client";

import Link from "next/link";
import { Share2, GitCompare, Bookmark } from "lucide-react";
import { useSavedPlayers } from "@/components/public/SavedPlayersProvider";

type ProfileQuickActionsProps = {
  slug: string;
  displayName: string;
};

export function ProfileQuickActions({ slug, displayName }: ProfileQuickActionsProps) {
  const { isSaved, toggle } = useSavedPlayers();
  const saved = isSaved(slug);

  async function shareProfile() {
    const url = `${window.location.origin}/players/${slug}`;
    if (navigator.share) {
      await navigator.share({ title: displayName, url });
      return;
    }
    await navigator.clipboard.writeText(url);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void shareProfile()}
        className="inline-flex items-center gap-2 rounded-sm border border-line-500 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-court-700 hover:border-court-900"
      >
        <Share2 className="h-4 w-4" aria-hidden="true" />
        Share
      </button>
      <Link
        href={`/players/compare?a=${encodeURIComponent(slug)}`}
        className="inline-flex items-center gap-2 rounded-sm border border-line-500 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-court-700 hover:border-court-900"
      >
        <GitCompare className="h-4 w-4" aria-hidden="true" />
        Compare
      </Link>
      <button
        type="button"
        onClick={() => toggle({ slug, displayName })}
        className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] ${
          saved ? "border-hardwood-600 bg-hardwood-600 text-white" : "border-line-500 bg-white text-court-700 hover:border-court-900"
        }`}
      >
        <Bookmark className="h-4 w-4" aria-hidden="true" />
        {saved ? "Saved" : "Save"}
      </button>
    </div>
  );
}
