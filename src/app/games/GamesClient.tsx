"use client";

import { useMemo, useState } from "react";
import type { PublicGameRow, PublicGamesIndex } from "@/lib/public-site-data";
import { EmptyState } from "@/components/ui";
import { FilterBar, FilterControlClass, FilterField } from "@/components/public/FilterBar";
import { GameList } from "@/components/public/GameList";

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
    awayTeam: { name: game.awayTeamName }
  };
}

export function GamesClient({ data }: { data: PublicGamesIndex }) {
  const [leagueId, setLeagueId] = useState("All");
  const [query, setQuery] = useState("");
  const controlClass = FilterControlClass();

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

  return (
    <section className="container-px py-8">
      <div className="mb-8 -mx-5 sm:-mx-8 lg:-mx-12 xl:-mx-16">
        <FilterBar
          summary={`${filtered.length} game${filtered.length === 1 ? "" : "s"} shown`}
          action={
            hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setLeagueId("All");
                  setQuery("");
                }}
                className="text-xs font-bold text-court-500 hover:text-hardwood-600"
              >
                Clear filters
              </button>
            ) : null
          }
        >
          <FilterField label="League">
            <select value={leagueId} onChange={(event) => setLeagueId(event.target.value)} className={controlClass}>
              <option value="All">All leagues</option>
              {data.leagues.map((league) => (
                <option key={league.id} value={league.id}>{league.name}</option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Team search">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search team name"
              className={controlClass}
            />
          </FilterField>
          <span className="hidden lg:block" />
          <span className="hidden lg:block" />
          <span className="hidden lg:block" />
        </FilterBar>
      </div>

      {filtered.length ? (
        <GameList games={filtered.map(toGameListRow)} />
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
    </section>
  );
}
