import Link from "next/link";
import type { HomeLeaderboardRow } from "@/lib/public-site-data";
import { formatBoardRank } from "@/lib/public-rank-display";
import { getPlayerProfileHref } from "@/lib/format";
import { getProgramDisplayName } from "@/lib/uaap-school-display";
import { ScoutRankChange } from "@/components/public/ScoutRankChange";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

type FeaturedProspectsGridProps = {
  players: HomeLeaderboardRow[];
  rankDeltaByPlayerId?: Record<string, number>;
};

export function FeaturedProspectsGrid({ players, rankDeltaByPlayerId = {} }: FeaturedProspectsGridProps) {
  if (!players.length) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {players.map((player) => {
        const delta = rankDeltaByPlayerId[player.playerId];
        return (
          <Link
            key={player.playerId}
            href={getPlayerProfileHref(player)}
            className="group overflow-hidden rounded-sm border border-white/[0.08] bg-court-800/90 text-left transition hover:border-hardwood-500/40"
          >
            <div className="prospect-portrait-frame relative h-40 overflow-hidden">
              {player.photoUrl ? (
                <img
                  src={player.photoUrl}
                  alt=""
                  className="absolute inset-x-0 bottom-0 z-[1] h-[92%] w-full object-contain object-bottom"
                />
              ) : (
                <span className="absolute inset-0 z-[1] grid place-items-center font-display text-5xl font-bold text-white/10">
                  {initials(player.displayName)}
                </span>
              )}
              <div className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-court-900/85 via-transparent to-transparent" />
              <div className="absolute left-2.5 top-2.5 z-[3] flex flex-col gap-1">
                  <span className="font-numeric text-3xl font-normal leading-none text-scout-orange-bright">
                    {formatBoardRank(player.rank)}
                  </span>
                  <span className="rounded-sm bg-court-900/70 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.08em] text-scout-500">
                    {player.ageGroup} {player.gender}
                  </span>
                </div>
                {delta !== undefined ? (
                  <div className="absolute right-2.5 top-2.5 z-[3]">
                    <ScoutRankChange delta={delta} />
                  </div>
                ) : null}
            </div>
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-base font-bold uppercase leading-tight text-scout-50 group-hover:text-scout-orange-bright">
                    {player.displayName}
                  </div>
                  <p className="mt-0.5 truncate text-[0.7rem] font-semibold text-scout-500">
                    {getProgramDisplayName(player.currentTeam)}
                  </p>
                </div>
                {player.position ? (
                  <span className="shrink-0 rounded-sm border border-white/10 bg-scout-900/60 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-scout-50">
                    {player.position}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/[0.08] pt-3">
                <div>
                  <div className="font-numeric text-sm font-normal italic text-scout-50">{player.rating.toFixed(1)}</div>
                  <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-scout-500">RTG</div>
                </div>
                <div>
                  <div className="font-numeric text-sm font-normal text-scout-50">{player.verifiedGameCount}</div>
                  <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-scout-500">GP</div>
                </div>
                <div>
                  <div className="font-numeric text-sm font-normal text-scout-50">{player.starRating}</div>
                  <div className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-scout-500">Stars</div>
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
