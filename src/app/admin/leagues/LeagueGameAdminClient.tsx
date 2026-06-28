"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";
import { updateOfficialGame, updateOfficialGameStat, type LeagueActionState } from "./actions";

const initialState: LeagueActionState = { ok: false, message: "" };

type GameStatRow = {
  id: string;
  playerName: string;
  teamName: string;
  points: number;
  rebounds: number;
  assists: number;
};

type AuditRow = {
  id: string;
  entityType: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string;
  createdAt: string;
  editorName: string;
};

export function LeagueGameAdminClient({
  leagueId,
  game,
  stats,
  audits
}: {
  leagueId: string;
  game: {
    id: string;
    gameNumber: string;
    gameDate: string;
    homeTeamName: string;
    awayTeamName: string;
    homeScore: number;
    awayScore: number;
  };
  stats: GameStatRow[];
  audits: AuditRow[];
}) {
  const [gameState, gameAction] = useFormState(updateOfficialGame, initialState);
  const [statState, statAction] = useFormState(updateOfficialGameStat, initialState);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="grid gap-6">
        <section className="border border-surface-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl font-bold text-navy-900">{game.gameNumber}</h2>
              <p className="text-sm text-ink-600">{game.homeTeamName} vs {game.awayTeamName}</p>
            </div>
            <Link href={`/admin/leagues/${leagueId}`} className="text-sm font-semibold text-orange-700 hover:text-orange-800">
              Back to league
            </Link>
          </div>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-surface-500">Date</dt><dd className="font-semibold">{game.gameDate}</dd></div>
            <div><dt className="text-surface-500">Score</dt><dd className="font-semibold">{game.homeScore}–{game.awayScore}</dd></div>
          </dl>
        </section>

        <section className="border-2 border-red-200 bg-red-50/30 p-4">
          <h3 className="font-display text-lg font-bold text-red-950">Edit official game data</h3>
          <p className="mt-1 text-sm text-red-900">Changes affect verified evidence and may require rating recomputation.</p>
          <AdminFormFeedback state={gameState} />
          <form action={gameAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <input type="hidden" name="leagueId" value={leagueId} />
            <input type="hidden" name="gameId" value={game.id} />
            <label className="grid gap-1 text-sm font-semibold">
              Game date
              <input name="gameDate" type="date" defaultValue={game.gameDate} required className="min-h-10 border border-surface-200 px-3" />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Confirm game number
              <input name="confirmGameNumber" required placeholder={game.gameNumber} className="min-h-10 border border-surface-200 px-3" />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Home score
              <input name="homeScore" type="number" min={0} max={300} defaultValue={game.homeScore} required className="min-h-10 border border-surface-200 px-3" />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Away score
              <input name="awayScore" type="number" min={0} max={300} defaultValue={game.awayScore} required className="min-h-10 border border-surface-200 px-3" />
            </label>
            <label className="grid gap-1 text-sm font-semibold md:col-span-2">
              Edit reason
              <textarea name="editReason" rows={2} required className="border border-surface-200 px-3 py-2" />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-red-900 md:col-span-2">
              <input type="checkbox" name="confirmEdit" required />
              I understand this edits official game evidence.
            </label>
            <AdminSaveButton label="Save game changes" className="w-fit" />
          </form>
        </section>

        <section className="border border-surface-200 bg-white p-4 shadow-sm">
          <h3 className="font-display text-lg font-bold text-navy-900">Player stats</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-surface-200 text-xs font-bold uppercase text-surface-500">
                <tr>
                  <th className="px-2 py-2">Player</th>
                  <th className="px-2 py-2">Team</th>
                  <th className="px-2 py-2 text-center">PTS</th>
                  <th className="px-2 py-2 text-center">REB</th>
                  <th className="px-2 py-2 text-center">AST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {stats.map((row) => (
                  <tr key={row.id}>
                    <td className="px-2 py-2 font-semibold">{row.playerName}</td>
                    <td className="px-2 py-2">{row.teamName}</td>
                    <td className="px-2 py-2 text-center">{row.points}</td>
                    <td className="px-2 py-2 text-center">{row.rebounds}</td>
                    <td className="px-2 py-2 text-center">{row.assists}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {stats[0] ? (
            <form action={statAction} className="mt-4 grid gap-3 border-t border-surface-200 pt-4 md:grid-cols-2">
              <input type="hidden" name="leagueId" value={leagueId} />
              <label className="grid gap-1 text-sm font-semibold md:col-span-2">
                Stat row
                <select name="gameStatId" defaultValue={stats[0].id} className="min-h-10 border border-surface-200 px-3">
                  {stats.map((row) => (
                    <option key={row.id} value={row.id}>{row.playerName} ({row.teamName})</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-semibold">Points<input name="points" type="number" min={0} max={120} defaultValue={stats[0].points} className="min-h-10 border border-surface-200 px-3" /></label>
              <label className="grid gap-1 text-sm font-semibold">Rebounds<input name="rebounds" type="number" min={0} max={60} defaultValue={stats[0].rebounds} className="min-h-10 border border-surface-200 px-3" /></label>
              <label className="grid gap-1 text-sm font-semibold">Assists<input name="assists" type="number" min={0} max={60} defaultValue={stats[0].assists} className="min-h-10 border border-surface-200 px-3" /></label>
              <label className="grid gap-1 text-sm font-semibold md:col-span-2">Edit reason<textarea name="editReason" rows={2} required className="border border-surface-200 px-3 py-2" /></label>
              <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2"><input type="checkbox" name="confirmEdit" required />Confirm stat edit</label>
              <AdminFormFeedback state={statState} />
              <AdminSaveButton label="Save stat changes" className="w-fit" />
            </form>
          ) : null}
        </section>
      </div>

      <aside className="border border-surface-200 bg-white p-4 shadow-sm">
        <h3 className="font-display text-lg font-bold text-navy-900">Edit history</h3>
        <div className="mt-3 max-h-[40rem] space-y-3 overflow-y-auto">
          {audits.map((row) => (
            <article key={row.id} className="border border-surface-100 bg-surface-50 p-3 text-sm">
              <p className="font-semibold text-navy-900">{row.fieldName} · {row.entityType}</p>
              <p className="text-ink-600">{row.oldValue ?? "—"} → {row.newValue ?? "—"}</p>
              <p className="mt-1 text-xs text-ink-500">{row.editorName} · {row.createdAt}</p>
              <p className="mt-1 text-xs text-ink-600">{row.reason}</p>
            </article>
          ))}
          {!audits.length ? <p className="text-sm text-ink-500">No edits recorded.</p> : null}
        </div>
      </aside>
    </div>
  );
}
