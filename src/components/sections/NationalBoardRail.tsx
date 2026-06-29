"use client";

import Link from "next/link";
import type { HomeLeaderboardRow, PublicGender } from "@/lib/public-site-data";
import { formatBoardRank } from "@/lib/public-rank-display";
import { getPlayerProfileHref } from "@/lib/format";
import { getProgramAbbreviation } from "@/lib/uaap-school-display";
import { ScoutRankChange } from "@/components/public/ScoutRankChange";

type NationalBoardRailProps = {
  players: HomeLeaderboardRow[];
  rankDeltaByPlayerId?: Record<string, number>;
  rankingsHref: string;
};

export function NationalBoardRail({
  players,
  rankDeltaByPlayerId = {},
  rankingsHref,
}: NationalBoardRailProps) {
  const boardRows = players.slice(0, 8);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-sm border border-white/[0.08] bg-scout-800/80">
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_3rem_3rem] gap-2 border-b border-white/[0.08] px-3 py-2.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-scout-500">
        <span>#</span>
        <span>Player</span>
        <span className="text-right">RTG</span>
        <span className="text-right">+/−</span>
      </div>
      {!boardRows.length ? (
        <p className="p-4 text-sm text-scout-500">No eligible players on this board yet.</p>
      ) : (
        boardRows.map((player, index) => {
          const delta = rankDeltaByPlayerId[player.playerId];
          return (
            <Link
              key={player.playerId}
              href={getPlayerProfileHref(player)}
              className={`grid grid-cols-[2.5rem_minmax(0,1fr)_3rem_3rem] items-center gap-2 px-3 py-2.5 transition hover:bg-court-800 ${
                index < boardRows.length - 1 ? "border-b border-white/[0.06]" : ""
              }`}
            >
              <span
                className={`font-numeric text-lg font-normal leading-none ${
                  player.rank <= 3 ? "text-scout-orange-bright" : "text-scout-500"
                }`}
              >
                {formatBoardRank(player.rank)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold leading-tight text-white">{player.displayName}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1">
                  {player.position ? (
                    <span className="text-[0.6rem] font-bold uppercase text-scout-orange-bright">{player.position}</span>
                  ) : null}
                  <span className="truncate text-[0.6rem] font-semibold text-scout-500">
                    {getProgramAbbreviation(player.currentTeam)}
                  </span>
                </span>
              </span>
              <span className="text-right font-numeric text-sm font-normal italic text-white">
                {player.rating.toFixed(0)}
              </span>
              <span className="flex justify-end">
                {delta !== undefined ? <ScoutRankChange delta={delta} /> : <ScoutRankChange delta={0} />}
              </span>
            </Link>
          );
        })
      )}
      <div className="mt-auto border-t border-white/[0.08] px-3 py-3">
        <Link
          href={rankingsHref}
          className="block text-center text-xs font-bold uppercase tracking-[0.1em] text-scout-orange-bright hover:text-hardwood-500"
        >
          Full Rankings →
        </Link>
      </div>
    </div>
  );
}

export function NationalBoardGenderToggle({
  gender,
  onGenderChange,
}: {
  gender: PublicGender;
  onGenderChange: (gender: PublicGender) => void;
}) {
  return (
    <div
      className="inline-flex shrink-0 rounded-sm border border-white/10 bg-court-900/80 p-0.5"
      role="group"
      aria-label="Gender"
    >
      {(["Boys", "Girls"] as const).map((option) => {
        const active = gender === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onGenderChange(option)}
            className={`rounded-sm px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] transition ${
              active ? "bg-court-700 text-white" : "text-scout-500 hover:text-white/80"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
