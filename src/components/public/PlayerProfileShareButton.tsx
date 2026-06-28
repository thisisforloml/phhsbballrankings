"use client";

import { Share2 } from "lucide-react";

export function PlayerProfileShareButton({ slug, title }: { slug: string; title: string }) {
  async function share() {
    const url = `${window.location.origin}/players/${slug}`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      // User cancelled share or clipboard denied — no-op.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="grid h-9 w-9 place-items-center rounded-full border-2 border-accent-500 text-accent-600 transition hover:bg-accent-50"
      aria-label="Share profile"
    >
      <Share2 className="h-4 w-4" strokeWidth={2.25} />
    </button>
  );
}
