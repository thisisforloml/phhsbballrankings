"use client";

import Link from "next/link";

import { ScoutRankChange } from "@/components/public/ScoutRankChange";
import { getPlayerProfileHref } from "@/lib/format";
import { formatBoardRank } from "@/lib/public-rank-display";
import type { HomeLeaderboardRow, PublicGender } from "@/lib/public-site-data";
import { getProgramAbbreviation } from "@/lib/uaap-school-display";

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
  const boardRows = players.slice(0, 10);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-sm border border-white/[0.08] bg-scout-800/80">
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_2.75rem_2.75rem] gap-1.5 border-b border-white/[0.08] px-2.5 py-2 text-[0.55rem] font-bold uppercase tracking-[0.1em] text-scout-500 md:grid-cols-[2.5rem_minmax(0,1fr)_3rem_3rem] md:gap-2 md:px-3 md:py-2.5 md:text-[0.6rem]">
        <span>#</span>
        <span>Player</span>
        <span className="text-right">Rating</span>
        <span className="text-right">Change</span>
      </div>
      {!boardRows.length ? (
        <p className="p-3 text-sm text-scout-500 md:p-4">No eligible players on this board yet.</p>
      ) : (
        boardRows.map((player, index) => {
          const delta = rankDeltaByPlayerId[player.playerId];
          return (
            <Link
              key={player.playerId}
              href={getPlayerProfileHref(player)}
              aria-label={`${player.displayName}, rank ${formatBoardRank(player.rank)}, rated ${player.rating.toFixed(0)}`}
              className={`home-mobile-tap-list grid grid-cols-[2rem_minmax(0,1fr)_2.75rem_2.75rem] items-center gap-1.5 px-2.5 py-1.5 transition-colors duration-200 hover:bg-court-800 md:grid-cols-[2.5rem_minmax(0,1fr)_3rem_3rem] md:gap-2 md:px-3 md:py-2.5 ${
                index < boardRows.length - 1 ? "border-b border-white/[0.06]" : ""
              }`}
            >
              <span
                className={`font-numeric text-base font-normal leading-none md:text-lg ${
                  player.rank <= 3 ? "text-scout-orange-bright" : "text-scout-500"
                }`}
              >
                {formatBoardRank(player.rank)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold leading-tight text-white md:text-xs">
                  {player.displayName}
                </span>
                <span className="mt-0 flex flex-wrap items-center gap-0.5 md:mt-0.5 md:gap-1">
                  {player.position ? (
                    <span className="text-[0.55rem] font-bold uppercase text-scout-orange-bright md:text-[0.6rem]">
                      {player.position}
                    </span>
                  ) : null}
                  <span className="truncate text-[0.55rem] font-semibold text-scout-500 md:text-[0.6rem]">
                    {getProgramAbbreviation(player.currentTeam)}
                  </span>
                </span>
              </span>
              <span className="text-right font-numeric text-base font-normal italic leading-none text-white md:text-sm">
                {player.rating.toFixed(0)}
              </span>
              <span className="flex justify-end">
                {delta !== undefined ? (
                  <ScoutRankChange delta={delta} className="max-md:text-[0.65rem] md:text-xs" />
                ) : (
                  <span className="font-numeric text-xs text-scout-500" aria-hidden="true">
                    —
                  </span>
                )}
              </span>
            </Link>
          );
        })
      )}
      <div className="mt-auto border-t border-white/[0.08] px-2.5 py-2 md:px-3 md:py-3">
        <Link
          href={rankingsHref}
          className="home-mobile-link block text-center text-xs font-bold uppercase tracking-[0.1em] text-scout-orange-bright transition-colors duration-200 hover:text-hardwood-500"
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
            aria-pressed={active}
            onClick={() => onGenderChange(option)}
            className={`home-mobile-tap-btn rounded-sm px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] transition-colors duration-200 ${
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
