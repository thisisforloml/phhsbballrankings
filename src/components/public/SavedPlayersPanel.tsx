"use client";

import Link from "next/link";

import { PortraitAvatar } from "@/components/public/PortraitAvatar";
import { useSavedPlayers } from "@/components/public/SavedPlayersProvider";

export function SavedPlayersPanel() {
  const { saved, remove } = useSavedPlayers();

  if (!saved.length) {
    return (
      <p className="text-sm font-semibold text-court-600">
        No saved players yet. Save profiles from player pages to build a recruiting short list.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {saved.map((player) => (
        <div key={player.slug} className="flex items-center gap-3 border border-line-500 bg-white p-3">
          <PortraitAvatar name={player.displayName} />
          <div className="min-w-0 flex-1">
            <Link href={`/players/${player.slug}`} className="block truncate font-bold text-court-900 hover:underline">
              {player.displayName}
            </Link>
            <small className="text-xs text-court-500">Saved {new Date(player.savedAt).toLocaleDateString("en-PH")}</small>
          </div>
          <button type="button" onClick={() => remove(player.slug)} className="text-xs font-bold text-court-500 hover:text-loss-text">
            Remove
          </button>
        </div>
      ))}
      <Link href="/players/compare" className="button secondary w-fit">
        Compare saved players
      </Link>
    </div>
  );
}
