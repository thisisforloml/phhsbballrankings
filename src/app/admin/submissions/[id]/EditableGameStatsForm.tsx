import Link from "next/link";
import type { Submission } from "@prisma/client";
import { safeParseSubmissionJson } from "@/lib/submission-json";
import { updateSubmissionStructuredDraft } from "../actions";

type JsonRecord = Record<string, unknown>;

const gameFields = ["gameNumber", "gameDate", "homeTeamName", "awayTeamName", "homeScore", "awayScore", "city", "region"] as const;
const playerFields = ["name", "team", "MIN", "PTS", "FGM", "FGA", "3PM", "3PA", "2PM", "2PA", "FTM", "FTA", "OREB", "DREB", "TRB", "AST", "STL", "BLK", "TOV", "PF", "FD", "+/-"] as const;
const numericFields = new Set(["homeScore", "awayScore", "PTS", "FGM", "FGA", "3PM", "3PA", "2PM", "2PA", "FTM", "FTA", "OREB", "DREB", "TRB", "AST", "STL", "BLK", "TOV", "PF", "FD", "+/-"]);

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function booleanValue(value: unknown) {
  return value === true;
}

function getPackages(submission: Pick<Submission, "rawText" | "parsedPreview">) {
  const result = safeParseSubmissionJson(submission);
  if (!result.ok) return [];
  const root = asRecord(result.data);
  if (root) return [root];
  return asArray(result.data).map(asRecord).filter((item): item is JsonRecord => item !== null);
}

function inputType(field: string) {
  if (field === "gameDate") return "date";
  if (numericFields.has(field)) return "number";
  return "text";
}

function inputClass(field: string) {
  if (field === "name") return "w-44";
  if (field === "team") return "w-36";
  if (field === "gameNumber" || field === "gameDate") return "w-36";
  if (field === "homeTeamName" || field === "awayTeamName" || field === "city" || field === "region") return "w-full";
  return "w-20";
}

export function EditableGameStatsForm({ submission }: { submission: Pick<Submission, "id" | "rawText" | "parsedPreview"> }) {
  const packages = getPackages(submission);

  if (!packages.length) {
    return <p className="rounded-md bg-surface-100 p-4 text-sm font-semibold text-ink-600">Structured editing is available after the draft JSON is valid.</p>;
  }

  return (
    <form action={updateSubmissionStructuredDraft} className="grid gap-5">
      <input type="hidden" name="submissionId" value={submission.id} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p><strong>Edits affect the submission draft only.</strong> Official games, stats, ratings, and rankings are unchanged until import.</p>
        <div className="flex gap-2">
          <button type="submit" className="button primary">Save Changes</button>
          <Link href={`/admin/submissions/${submission.id}`} className="button secondary">Cancel</Link>
        </div>
      </div>

      {packages.map((submissionPackage, packageIndex) => {
        const games = asArray(submissionPackage.games).map(asRecord).filter((game): game is JsonRecord => game !== null);
        return games.map((game, gameIndex) => {
          const players = asArray(game.players).map(asRecord).filter((player): player is JsonRecord => player !== null);
          const title = displayValue(game.gameNumber) || `Game ${gameIndex + 1}`;
          const isTeamResultOnly = booleanValue(game.teamResultOnly) || booleanValue(game.defaultWin);

          return (
            <section key={`${packageIndex}-${gameIndex}`} className="rounded-lg border border-surface-200 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-2xl text-navy-800">{title}</h3>
                {isTeamResultOnly ? <span className="rounded-full bg-amber-50 px-3 py-1 font-mono text-[0.65rem] uppercase text-amber-800">Default / forfeit</span> : null}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {gameFields.map((field) => (
                  <label key={field} className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-surface-600">
                    {field}
                    <input
                      name={`game.${packageIndex}.${gameIndex}.${field}`}
                      type={inputType(field)}
                      defaultValue={displayValue(game[field])}
                      className="min-h-10 rounded-md border border-surface-200 px-2 py-1 text-sm font-normal normal-case tracking-normal text-ink-900"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-4 overflow-x-auto rounded-md border border-surface-200">
                {isTeamResultOnly && !players.length ? (
                  <p className="p-4 text-sm font-semibold text-ink-600">No player stat rows are included for this default/forfeit result.</p>
                ) : <table className="w-full min-w-[110rem] text-left text-sm">
                  <thead className="bg-surface-100 font-mono text-mono-sm uppercase text-surface-600">
                    <tr>
                      {playerFields.map((field) => <th key={field} className="px-2 py-2">{field}</th>)}
                      <th className="px-2 py-2">FG%</th>
                      <th className="px-2 py-2">3P%</th>
                      <th className="px-2 py-2">2P%</th>
                      <th className="px-2 py-2">FT%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, playerIndex) => (
                      <tr key={`${packageIndex}-${gameIndex}-${playerIndex}`} className="border-t border-surface-200 align-top">
                        {playerFields.map((field) => (
                          <td key={field} className="px-2 py-2">
                            <input
                              name={`player.${packageIndex}.${gameIndex}.${playerIndex}.${field}`}
                              type={inputType(field)}
                              step={numericFields.has(field) ? "1" : undefined}
                              defaultValue={displayValue(player[field])}
                              className={`${inputClass(field)} min-h-9 rounded-md border border-surface-200 px-2 py-1 text-sm`}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2 text-ink-500">{displayValue(player["FG%"] ?? player.FGPct)}</td>
                        <td className="px-2 py-2 text-ink-500">{displayValue(player["3P%"] ?? player.threePct)}</td>
                        <td className="px-2 py-2 text-ink-500">{displayValue(player["2P%"] ?? player.twoPct)}</td>
                        <td className="px-2 py-2 text-ink-500">{displayValue(player["FT%"] ?? player.ftPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
              </div>
            </section>
          );
        });
      })}
    </form>
  );
}
