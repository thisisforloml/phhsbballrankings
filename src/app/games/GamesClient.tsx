"use client";

import { useMemo, useState } from "react";
import type { PublicGameRow, PublicGamesIndex } from "@/lib/public-site-data";
import { EmptyState } from "@/components/ui";
import { GameScoreBoard } from "@/components/public/GameScoreBoard";

function toGameListRow(game: PublicGameRow) {
  return {
    id: game.id,
    gameNumber: game.gameNumber,
    gameDate: game.gameDate,
    verificationStatus: game.verificationStatus,
    leagueName: game.leagueName,
    seasonName: game.seasonName,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    homeTeam: { name: game.homeTeamName },
    awayTeam: { name: game.awayTeamName },
  };
}

export function GamesClient({ data }: { data: PublicGamesIndex }) {
  const [leagueId, setLeagueId] = useState("All");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return data.games
      .filter((game) => leagueId === "All" || game.leagueId === leagueId)
      .filter((game) => {
        if (!value) return true;
        return [game.homeTeamName, game.awayTeamName, game.leagueName, game.seasonName]
          .join(" ")
          .toLowerCase()
          .includes(value);
      });
  }, [data.games, leagueId, query]);

  const hasActiveFilters = leagueId !== "All" || query.trim().length > 0;
  const controlClass =
    "min-h-10 w-full border border-white/[0.08] bg-scout-700 px-3 py-2 text-sm font-medium text-scout-50 outline-none focus:border-scout-orange";

  return (
    <section className="container-px py-6 md:py-8">
      <div className="mx-auto max-w-[74rem]">
        <div className="mb-6 grid gap-3 rounded-sm border border-white/[0.08] bg-scout-800/80 p-4 md:grid-cols-[12rem_1fr_auto] md:items-end">
          <label className="grid gap-1.5">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-scout-orange-bright">
              <span aria-hidden="true" className="inline-block h-4 w-1 bg-scout-orange" />
              League
            </span>
            <select value={leagueId} onChange={(event) => setLeagueId(event.target.value)} className={controlClass}>
              <option value="All">All leagues</option>
              {data.leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-scout-orange-bright">
              <span aria-hidden="true" className="inline-block h-4 w-1 bg-scout-orange" />
              Team search
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search team name"
              className={controlClass}
            />
          </label>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={() => {
                setLeagueId("All");
                setQuery("");
              }}
              className="justify-self-start text-sm font-semibold text-white/50 hover:text-white md:justify-self-end md:pb-2"
            >
              Clear filters
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>

        <p className="mb-5 text-xs font-semibold text-white/45">
          {filtered.length} game{filtered.length === 1 ? "" : "s"} shown
        </p>

        {filtered.length ? (
          <GameScoreBoard games={filtered.map(toGameListRow)} />
        ) : (
          <EmptyState
            icon="scores"
            title={hasActiveFilters ? "No games match these filters" : "No official games listed yet"}
            description={
              hasActiveFilters
                ? "Try another league or team name. All listed games are verified official results."
                : "Verified official games will appear here as they are imported and published."
            }
          />
        )}
      </div>
    </section>
  );
}
