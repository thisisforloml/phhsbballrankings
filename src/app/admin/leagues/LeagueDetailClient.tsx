"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";
import { updateLeagueMetadata, type LeagueActionState } from "./actions";

const initialState: LeagueActionState = { ok: false, message: "" };

export function LeagueMetadataForm({
  league
}: {
  league: { id: string; name: string; tier: number; logoUrl: string | null };
}) {
  const [state, action] = useFormState(updateLeagueMetadata, initialState);

  return (
    <section className="border border-surface-200 bg-white p-4 shadow-sm">
      <h2 className="font-display text-lg font-bold text-navy-900">League settings</h2>
      <AdminFormFeedback state={state} />
      <form action={action} className="mt-4 grid gap-3 md:grid-cols-3">
        <input type="hidden" name="leagueId" value={league.id} />
        <label className="grid gap-1 text-sm font-semibold md:col-span-2">
          Name
          <input name="name" defaultValue={league.name} required maxLength={160} className="min-h-10 border border-surface-200 px-3" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Tier
          <input name="tier" type="number" min={1} max={4} defaultValue={league.tier} required className="min-h-10 border border-surface-200 px-3" />
        </label>
        <label className="grid gap-1 text-sm font-semibold md:col-span-3">
          Logo URL
          <input name="logoUrl" defaultValue={league.logoUrl ?? ""} maxLength={500} className="min-h-10 border border-surface-200 px-3" placeholder="Optional" />
        </label>
        <AdminSaveButton label="Save league" className="w-fit" />
      </form>
    </section>
  );
}

export function LeagueSeasonGames({
  leagueId,
  seasons
}: {
  leagueId: string;
  seasons: Array<{
    id: string;
    name: string;
    seasonYear: number;
    startsOn: string;
    endsOn: string | null;
    games: Array<{
      id: string;
      gameNumber: string;
      gameDate: string;
      homeTeamName: string;
      awayTeamName: string;
      homeScore: number;
      awayScore: number;
    }>;
  }>;
}) {
  return (
    <section className="grid gap-4">
      {seasons.map((season) => (
        <article key={season.id} className="border border-surface-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-navy-900">{season.name}</h2>
            <span className="text-sm text-ink-600">{season.seasonYear} · {season.startsOn} – {season.endsOn ?? "—"}</span>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-surface-200 font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-surface-500">
                <tr>
                  <th className="px-2 py-2">Game</th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Matchup</th>
                  <th className="px-2 py-2 text-center">Score</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {season.games.map((game) => (
                  <tr key={game.id}>
                    <td className="px-2 py-2 font-semibold text-navy-900">{game.gameNumber}</td>
                    <td className="px-2 py-2 text-ink-600">{game.gameDate}</td>
                    <td className="px-2 py-2 text-ink-700">{game.homeTeamName} vs {game.awayTeamName}</td>
                    <td className="px-2 py-2 text-center font-semibold text-ink-900">{game.homeScore}–{game.awayScore}</td>
                    <td className="px-2 py-2 text-right">
                      <Link href={`/admin/leagues/${leagueId}/games/${game.id}`} className="text-sm font-semibold text-orange-700 hover:text-orange-800">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
                {!season.games.length ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-4 text-center text-ink-500">No games.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </section>
  );
}
