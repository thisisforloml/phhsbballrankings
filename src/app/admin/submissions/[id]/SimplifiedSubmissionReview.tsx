import Link from "next/link";
import type { Submission, UserRole } from "@prisma/client";
import type { SubmissionReview } from "@/lib/submission-review";
import { publishSubmission, updateSubmissionDraftJson } from "../actions";
import { safeParseSubmissionJson } from "@/lib/submission-json";
import { EditableGameStatsForm } from "./EditableGameStatsForm";

type JsonRecord = Record<string, unknown>;

type SubmissionWithSubmitter = Submission & {
  submittedBy: {
    id: string;
    name: string;
    username: string;
    email: string | null;
    role: UserRole;
  };
};

type SimplifiedSubmissionReviewProps = {
  submission: SubmissionWithSubmitter;
  review: SubmissionReview;
  preflight: any;
  pipelineStatus: any;
  reviewSuccess?: string;
  reviewError?: string;
  editMode?: boolean;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function parseFullSubmissionPackages(submission: Pick<Submission, "rawText" | "parsedPreview">): JsonRecord[] {
  const result = safeParseSubmissionJson(submission);
  if (!result.ok) return [];

  const root = asRecord(result.data);
  if (root) return [root];
  return asArray(result.data).map(asRecord).filter((item): item is JsonRecord => item !== null);
}

function stat(player: JsonRecord, key: string) {
  return displayValue(player[key]);
}

function statPair(player: JsonRecord, madeKey: string, attemptedKey: string) {
  return `${stat(player, madeKey)}/${stat(player, attemptedKey)}`;
}

function getGameRows(submission: Pick<Submission, "rawText" | "parsedPreview">) {
  const packages = parseFullSubmissionPackages(submission);
  return packages.flatMap((submissionPackage) => asArray(submissionPackage.games).map(asRecord).filter((game): game is JsonRecord => game !== null));
}

function readinessLabel(submission: Submission, preflight: any, pipelineStatus: any) {
  if (pipelineStatus?.published) return "Published";
  if (submission.status === "APPROVED" && !preflight?.overallSummary?.importBlocked) return "Ready to Publish";
  return "Needs Review";
}

function readinessClass(label: string) {
  if (label === "Published") return "bg-green-50 text-green-800";
  if (label === "Ready to Publish") return "bg-blue-50 text-blue-800";
  return "bg-amber-50 text-amber-800";
}

function statusClass(status: string) {
  if (status === "IMPORTED") return "bg-navy-50 text-navy-800";
  if (status === "APPROVED") return "bg-green-50 text-green-800";
  if (status === "REJECTED") return "bg-red-50 text-red-800";
  if (status === "UNDER_REVIEW") return "bg-amber-50 text-amber-800";
  return "bg-surface-100 text-surface-700";
}

function pointTotalStatus(gameNumber: string, review: SubmissionReview) {
  const check = review.validation.pointTotals.find((item) => item.gameNumber === gameNumber);
  if (!check) return { label: "Not checked", pass: false };
  return { label: check.homePass && check.awayPass ? "Passed" : "Failed", pass: check.homePass && check.awayPass };
}


function publishBlockers(submission: Submission, review: SubmissionReview, preflight: any, jsonInvalid: boolean, jsonParseResult: ReturnType<typeof safeParseSubmissionJson>) {
  const blockers: string[] = [];
  if (submission.status === "REJECTED") blockers.push("Cannot publish a rejected submission. Move it back under review first.");
  if (jsonInvalid && !jsonParseResult.ok) {
    blockers.push(`Invalid JSON: ${jsonParseResult.errorMessage}${jsonParseResult.line && jsonParseResult.column ? ` at line ${jsonParseResult.line}, column ${jsonParseResult.column}` : ""}`);
  }
  if (!review.validJson && review.parseError) blockers.push(`Invalid JSON: ${review.parseError}`);

  if (submission.status !== "IMPORTED") {
    for (const blocker of preflight?.overallSummary?.blockers ?? []) {
      if (blocker === "Submission must be APPROVED before import preflight can be considered ready.") continue;
      blockers.push(blocker);
    }
  }

  return Array.from(new Set(blockers));
}
function plainValidationMessages(review: SubmissionReview, preflight: any) {
  const messages: string[] = [];

  for (const check of review.validation.pointTotals) {
    if (!check.homePass || !check.awayPass) {
      messages.push(`Player points do not match final score for ${check.gameNumber}: ${check.homeTeamName} ${check.homeScore} vs ${check.awayTeamName} ${check.awayScore}.`);
    }
  }

  for (const issue of review.validation.missingRequiredFields) {
    const location = issue.scope === "player"
      ? `${issue.playerName ?? "Player"}${issue.gameNumber ? ` in ${issue.gameNumber}` : ""}`
      : issue.scope === "game"
        ? issue.gameNumber ?? "Game"
        : "Submission";
    messages.push(`Missing stat field: ${issue.missingFields.join(", ")} (${location}).`);
  }

  for (const issue of review.validation.teamNamesNotMatchingGameTeams) {
    messages.push(`Team name needs review: ${issue.playerName} is listed as ${issue.team} in ${issue.gameNumber}.`);
  }

  for (const issue of review.validation.duplicatePlayerNamesWithinGames) {
    messages.push(`Duplicate player row: ${issue.playerName} appears ${issue.count} times for ${issue.team} in ${issue.gameNumber}.`);
  }

  for (const player of preflight?.players ?? []) {
    const possible = player.possibleCaseMatches?.[0]?.displayName;
    if (player.action === "manual_review" && possible) {
      messages.push(`Player name may already exist: ${player.submittedName} -> ${possible}.`);
    }
  }

  for (const team of preflight?.teams ?? []) {
    if (team.action === "manual_review") messages.push(`Team name needs review: ${team.submittedTeamName}.`);
  }

  for (const issue of preflight?.gameStats?.issues ?? []) {
    messages.push(`Stat row needs review: ${issue.playerName} in ${issue.gameNumber} (${issue.reason}).`);
  }

  for (const blocker of preflight?.overallSummary?.blockers ?? []) {
    messages.push(blocker);
  }

  return Array.from(new Set(messages));
}

export function SimplifiedSubmissionReview({ submission, review, preflight, pipelineStatus, reviewSuccess, reviewError, editMode = false }: SimplifiedSubmissionReviewProps) {
  const jsonParseResult = safeParseSubmissionJson(submission);
  const jsonInvalid = !jsonParseResult.ok;
  const games = jsonInvalid ? [] : getGameRows(submission);
  const readiness = readinessLabel(submission, preflight, pipelineStatus);
  const messages = plainValidationMessages(review, preflight);
  const gender = review.recommendations.inferredGender ?? preflight?.league?.inferredGender ?? "-";
  const canEditDraft = submission.status !== "IMPORTED" && Boolean(submission.rawText?.trim());
  const canEditGameStats = canEditDraft && !jsonInvalid && games.length > 0;
  const blockers = publishBlockers(submission, review, preflight, jsonInvalid, jsonParseResult);
  const canPublish = blockers.length === 0 && ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "IMPORTED"].includes(submission.status);

  return (
    <div className="grid gap-6">
      {reviewSuccess ? <p className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">{reviewSuccess}</p> : null}
      {reviewError ? <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{reviewError}</p> : null}

      <section className="grid gap-5 rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label">Admin review</p>
            <h2 className="mt-2 font-display text-3xl text-navy-800">{submission.title}</h2>
            <p className="mt-2 max-w-3xl text-sm text-ink-600">Review the submitted games, fix draft data before import if needed, then publish through the guided workflow.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-4 py-2 font-mono text-mono-sm uppercase ${statusClass(submission.status)}`}>{submission.status}</span>
            <span className={`rounded-full px-4 py-2 font-mono text-mono-sm uppercase ${readinessClass(readiness)}`}>{readiness}</span>
          </div>
        </div>

        <dl className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">League</dt><dd>{review.summary.leagueName ?? submission.leagueName ?? "-"}</dd></div>
          <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Age group</dt><dd>{review.summary.ageGroup ?? "-"}</dd></div>
          <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Gender</dt><dd>{gender}</dd></div>
          <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Games</dt><dd>{review.summary.gameCount}</dd></div>
          <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Player rows</dt><dd>{review.summary.totalPlayerRows}</dd></div>
          <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Submitted by</dt><dd>{submission.submittedBy.name}</dd></div>
        </dl>

        {canPublish ? (
          <form action={publishSubmission} className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            <input type="hidden" name="submissionId" value={submission.id} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <strong className="block">Publish</strong>
                <p className="mt-1">Runs review approval, official import, ratings, rankings, and validation when ready.</p>
              </div>
              <button type="submit" className="rounded-md bg-green-700 px-5 py-2 font-semibold text-white hover:bg-green-800">Publish</button>
            </div>
          </form>
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong className="block">Cannot publish yet</strong>
            <ul className="mt-2 grid gap-1">
              {blockers.length ? blockers.map((blocker) => <li key={blocker}>{blocker}</li>) : <li>Publish is not available for this submission state.</li>}
            </ul>
          </div>
        )}
      </section>

      {jsonInvalid ? (
        <section className="grid gap-3 rounded-lg border border-red-200 bg-white p-6 shadow-sm">
          <div>
            <p className="label text-red-700">JSON formatting error</p>
            <h2 className="mt-2 font-display text-3xl text-red-800">Fix the submitted JSON before review</h2>
          </div>
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-900">
            <p className="font-semibold">{jsonParseResult.errorMessage}</p>
            {jsonParseResult.line && jsonParseResult.column ? <p className="mt-1">Line {jsonParseResult.line}, column {jsonParseResult.column}</p> : null}
            {typeof jsonParseResult.position === "number" ? <p className="mt-1">Character position {jsonParseResult.position}</p> : null}
          </div>
          <p className="text-sm text-ink-600">Use the draft editor below to correct the JSON. Import and publish actions stay disabled until the JSON can be parsed.</p>
        </section>
      ) : null}

      <section className="grid gap-4 rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl text-navy-800">Validation Messages</h2>
            <p className="mt-1 text-sm text-ink-600">Plain-language checks for the submitted game data.</p>
          </div>
          <span className={`rounded-full px-3 py-1 font-mono text-[0.65rem] uppercase ${messages.length ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800"}`}>{messages.length ? "Needs Review" : "Passed"}</span>
        </div>
        {messages.length ? (
          <ul className="grid gap-2 text-sm text-ink-700">
            {messages.slice(0, 20).map((message) => <li key={message} className="rounded-md bg-amber-50 p-3 text-amber-900">{message}</li>)}
          </ul>
        ) : (
          <p className="rounded-md bg-green-50 p-3 text-sm font-semibold text-green-800">No blocking validation messages found in the review summary.</p>
        )}
      </section>

      <section className="grid gap-4 rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl text-navy-800">{editMode ? "Edit Game Stats" : "Submitted Games"}</h2>
            <p className="mt-1 text-sm text-ink-600">{editMode ? "Edits affect the submission draft only. Official data is unchanged until import." : "Game information, teams, scores, and player stat rows from the submitted draft."}</p>
          </div>
          {canEditGameStats && !editMode ? <Link href={`/admin/submissions/${submission.id}?editStats=1`} className="button primary">Edit Game Stats</Link> : null}
          {submission.status === "IMPORTED" ? <span className="rounded-full bg-navy-50 px-3 py-1 font-mono text-[0.65rem] uppercase text-navy-800">Read-only imported</span> : null}
        </div>
        {editMode && canEditGameStats ? <EditableGameStatsForm submission={submission} /> : !jsonInvalid && games.length ? games.map((game) => {
          const gameNumber = stringValue(game.gameNumber) || "Unknown game";
          const players = asArray(game.players).map(asRecord).filter((player): player is JsonRecord => player !== null);
          const pointStatus = pointTotalStatus(gameNumber, review);

          return (
            <section key={gameNumber} className="rounded-lg border border-surface-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl text-navy-800">{gameNumber}</h3>
                  <p className="mt-1 text-sm text-ink-500">{displayValue(game.gameDate)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 font-mono text-[0.65rem] uppercase ${pointStatus.pass ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>Point total: {pointStatus.label}</span>
              </div>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Home</dt><dd>{displayValue(game.homeTeamName)} - {displayValue(game.homeScore)}</dd></div>
                <div className="rounded-md bg-surface-100 p-3"><dt className="font-semibold text-surface-500">Away</dt><dd>{displayValue(game.awayTeamName)} - {displayValue(game.awayScore)}</dd></div>
              </div>
              <div className="mt-4 overflow-x-auto rounded-md border border-surface-200">
                <table className="w-full min-w-[70rem] text-left text-sm">
                  <thead className="bg-surface-100 font-mono text-mono-sm uppercase text-surface-600">
                    <tr>
                      <th className="px-3 py-2">Player</th>
                      <th className="px-3 py-2">Team</th>
                      <th className="px-3 py-2">MIN</th>
                      <th className="px-3 py-2">PTS</th>
                      <th className="px-3 py-2">REB</th>
                      <th className="px-3 py-2">AST</th>
                      <th className="px-3 py-2">STL</th>
                      <th className="px-3 py-2">BLK</th>
                      <th className="px-3 py-2">TO</th>
                      <th className="px-3 py-2">PF</th>
                      <th className="px-3 py-2">FGM/FGA</th>
                      <th className="px-3 py-2">3PM/3PA</th>
                      <th className="px-3 py-2">FTM/FTA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map((player, index) => (
                      <tr key={`${gameNumber}-${stringValue(player.name)}-${index}`} className="border-t border-surface-200">
                        <td className="px-3 py-2 font-semibold text-ink-900">{displayValue(player.name)}</td>
                        <td className="px-3 py-2">{displayValue(player.team)}</td>
                        <td className="px-3 py-2">{stat(player, "MIN")}</td>
                        <td className="px-3 py-2">{stat(player, "PTS")}</td>
                        <td className="px-3 py-2">{stat(player, "TRB")}</td>
                        <td className="px-3 py-2">{stat(player, "AST")}</td>
                        <td className="px-3 py-2">{stat(player, "STL")}</td>
                        <td className="px-3 py-2">{stat(player, "BLK")}</td>
                        <td className="px-3 py-2">{stat(player, "TOV")}</td>
                        <td className="px-3 py-2">{stat(player, "PF")}</td>
                        <td className="px-3 py-2">{statPair(player, "FGM", "FGA")}</td>
                        <td className="px-3 py-2">{statPair(player, "3PM", "3PA")}</td>
                        <td className="px-3 py-2">{statPair(player, "FTM", "FTA")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        }) : (
          <p className="rounded-md bg-surface-100 p-4 text-sm font-semibold text-ink-600">No game/player table is shown until the submitted JSON can be parsed.</p>
        )}
      </section>

      {canEditDraft ? (
        <details className="rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
          <summary className="cursor-pointer font-display text-2xl text-navy-800">Edit Draft JSON</summary>
          <form action={updateSubmissionDraftJson} className="mt-4 grid gap-3">
            <input type="hidden" name="submissionId" value={submission.id} />
            <p className="text-sm text-ink-600">Use this only before import to correct names, teams, scores, or stat values in the draft submission. Saving refreshes review validation and does not import official data.</p>
            <textarea name="rawText" required rows={18} defaultValue={submission.rawText ?? ""} className="rounded-md border border-surface-200 px-3 py-2 font-mono text-xs" />
            <button type="submit" className="button primary w-fit">Save Draft Changes</button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
