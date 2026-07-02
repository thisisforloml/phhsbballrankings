import Link from "next/link";

import { ScoutRankChange } from "@/components/public/ScoutRankChange";
import { getPlayerProfileHref } from "@/lib/format";
import { formatBoardRank } from "@/lib/public-rank-display";
import type { HomeRankMover } from "@/lib/public-site-data";

export function BoardMovementCards({ movers }: { movers: HomeRankMover[] }) {
  if (!movers.length) return null;

  const displayMovers = movers.slice(0, 6);
  const columnClass =
    displayMovers.length === 5
      ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6";

  return (
    <div className={`grid gap-3 ${columnClass}`}>
      {displayMovers.map((mover) => (
        <Link
          key={mover.playerId}
          href={getPlayerProfileHref({ slug: mover.slug })}
          aria-label={`${mover.displayName}, now rank ${mover.currentRank}, ${mover.delta > 0 ? `up ${mover.delta}` : `down ${Math.abs(mover.delta)}`} places`}
          className="home-mobile-tap-card rounded-sm border border-white/[0.08] bg-scout-800/80 p-3 text-left transition-colors duration-200 hover:border-scout-orange/40 hover:bg-scout-800"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-numeric text-2xl font-normal leading-none text-scout-50">{formatBoardRank(mover.currentRank)}</span>
            <ScoutRankChange delta={mover.delta} />
          </div>
          <div className="truncate text-xs font-bold uppercase leading-tight text-scout-50">{mover.displayName}</div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="font-numeric text-sm font-normal italic text-scout-orange-bright">{mover.rating.toFixed(1)}</span>
            {mover.previousRank ? (
              <span className="text-[0.65rem] font-semibold text-scout-500">was {formatBoardRank(mover.previousRank)}</span>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}
