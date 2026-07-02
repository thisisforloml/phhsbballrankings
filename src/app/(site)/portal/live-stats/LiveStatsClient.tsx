"use client";

import { Activity, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { createManualStatsSubmission } from "@/app/(site)/organizer/live-stats/actions";
import { AdminAlert } from "@/components/admin/AdminAlert";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";

type PlayerSuggestion = {
  id: string;
  displayName: string;
  gender: "BOYS" | "GIRLS";
  region: string;
  city: string;
};

type GameDetails = {
  leagueName: string;
  ageGroup: "U13" | "U16" | "U19";
  gender: "BOYS" | "GIRLS";
  season: string;
  seasonYear: string;
  gameNumber: string;
  gameDate: string;
  homeTeamName: string;
  awayTeamName: string;
  homeQ1: string;
  homeQ2: string;
  homeQ3: string;
  homeQ4: string;
  homeOT: string;
  awayQ1: string;
  awayQ2: string;
  awayQ3: string;
  awayQ4: string;
  awayOT: string;
  city: string;
  region: string;
};

type StatRow = {
  id: number;
  name: string;
  starter: boolean;
  MIN: string;
  PTS: string;
  FGM: string;
  FGA: string;
  threePM: string;
  threePA: string;
  twoPM: string;
  twoPA: string;
  FTM: string;
  FTA: string;
  OREB: string;
  DREB: string;
  TRB: string;
  AST: string;
  STL: string;
  BLK: string;
  TOV: string;
  PF: string;
  FD: string;
  plusMinus: string;
};

type TeamTotals = {
  MIN: string;
  PTS: number;
  FGM: number;
  FGA: number;
  threePM: number;
  threePA: number;
  twoPM: number;
  twoPA: number;
  FTM: number;
  FTA: number;
  OREB: number;
  DREB: number;
  TRB: number;
  AST: number;
  STL: number;
  BLK: number;
  TOV: number;
  PF: number;
  FD: number;
  plusMinus: number;
};

type ActiveTeam = "home" | "away";
type StatKey = Exclude<keyof StatRow, "id" | "name" | "starter">;
type StatColumn = { key: StatKey; label: string; width?: string };

const coreStatColumns: StatColumn[] = [
  { key: "MIN", label: "MIN" },
  { key: "PTS", label: "PTS" },
  { key: "FGM", label: "FGM" },
  { key: "FGA", label: "FGA" },
  { key: "AST", label: "AST" },
  { key: "OREB", label: "OREB" },
  { key: "DREB", label: "DREB" },
  { key: "TRB", label: "TRB" },
  { key: "STL", label: "STL" },
  { key: "BLK", label: "BLK" },
  { key: "TOV", label: "TOV" },
  { key: "PF", label: "PF" }
];

const shootingDetailColumns: StatColumn[] = [
  { key: "threePM", label: "3PM" },
  { key: "threePA", label: "3PA" },
  { key: "twoPM", label: "2PM" },
  { key: "twoPA", label: "2PA" },
  { key: "FTM", label: "FTM" },
  { key: "FTA", label: "FTA" }
];

const advancedStatColumns: StatColumn[] = [
  { key: "FD", label: "FD" },
  { key: "plusMinus", label: "+/-" }
];

function emptyRow(id: number): StatRow {
  return {
    id,
    name: "",
    starter: false,
    MIN: "00:00",
    PTS: "0",
    FGM: "0",
    FGA: "0",
    threePM: "0",
    threePA: "0",
    twoPM: "0",
    twoPA: "0",
    FTM: "0",
    FTA: "0",
    OREB: "0",
    DREB: "0",
    TRB: "0",
    AST: "0",
    STL: "0",
    BLK: "0",
    TOV: "0",
    PF: "0",
    FD: "0",
    plusMinus: "0"
  };
}

function toInt(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMinutesToSeconds(value: string) {
  if (!/^\d{1,2}:\d{2}$/.test(value.trim())) return null;
  const [minutes, seconds] = value.split(":").map(Number);
  if (minutes < 0 || seconds < 0 || seconds > 59) return null;
  return minutes * 60 + seconds;
}

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function rowPayload(row: StatRow, team: string) {
  return {
    team,
    name: row.name,
    starter: row.starter,
    MIN: row.MIN,
    PTS: toInt(row.PTS),
    FGM: toInt(row.FGM),
    FGA: toInt(row.FGA),
    "3PM": toInt(row.threePM),
    "3PA": toInt(row.threePA),
    "2PM": toInt(row.twoPM),
    "2PA": toInt(row.twoPA),
    FTM: toInt(row.FTM),
    FTA: toInt(row.FTA),
    OREB: toInt(row.OREB),
    DREB: toInt(row.DREB),
    TRB: toInt(row.TRB),
    AST: toInt(row.AST),
    STL: toInt(row.STL),
    BLK: toInt(row.BLK),
    TOV: toInt(row.TOV),
    PF: toInt(row.PF),
    FD: toInt(row.FD),
    "+/-": toInt(row.plusMinus)
  };
}

function finalScore(details: GameDetails, team: "home" | "away") {
  return toInt(details[`${team}Q1`]) + toInt(details[`${team}Q2`]) + toInt(details[`${team}Q3`]) + toInt(details[`${team}Q4`]) + toInt(details[`${team}OT`]);
}

function buildPayload(details: GameDetails, homeRows: StatRow[], awayRows: StatRow[]) {
  return {
    ...details,
    seasonYear: toInt(details.seasonYear),
    homeScore: finalScore(details, "home"),
    awayScore: finalScore(details, "away"),
    homeQ1: toInt(details.homeQ1),
    homeQ2: toInt(details.homeQ2),
    homeQ3: toInt(details.homeQ3),
    homeQ4: toInt(details.homeQ4),
    homeOT: toInt(details.homeOT),
    awayQ1: toInt(details.awayQ1),
    awayQ2: toInt(details.awayQ2),
    awayQ3: toInt(details.awayQ3),
    awayQ4: toInt(details.awayQ4),
    awayOT: toInt(details.awayOT),
    players: [
      ...homeRows.filter((row) => row.name.trim()).map((row) => rowPayload(row, details.homeTeamName)),
      ...awayRows.filter((row) => row.name.trim()).map((row) => rowPayload(row, details.awayTeamName))
    ]
  };
}

function totals(rows: StatRow[]): TeamTotals {
  const totalSeconds = rows.reduce((sum, row) => sum + (parseMinutesToSeconds(row.MIN) ?? 0), 0);
  return rows.reduce((total, row) => ({
    MIN: formatSeconds(totalSeconds),
    PTS: total.PTS + toInt(row.PTS),
    FGM: total.FGM + toInt(row.FGM),
    FGA: total.FGA + toInt(row.FGA),
    threePM: total.threePM + toInt(row.threePM),
    threePA: total.threePA + toInt(row.threePA),
    twoPM: total.twoPM + toInt(row.twoPM),
    twoPA: total.twoPA + toInt(row.twoPA),
    FTM: total.FTM + toInt(row.FTM),
    FTA: total.FTA + toInt(row.FTA),
    OREB: total.OREB + toInt(row.OREB),
    DREB: total.DREB + toInt(row.DREB),
    TRB: total.TRB + toInt(row.TRB),
    AST: total.AST + toInt(row.AST),
    STL: total.STL + toInt(row.STL),
    BLK: total.BLK + toInt(row.BLK),
    TOV: total.TOV + toInt(row.TOV),
    PF: total.PF + toInt(row.PF),
    FD: total.FD + toInt(row.FD),
    plusMinus: total.plusMinus + toInt(row.plusMinus)
  }), {
    MIN: "00:00",
    PTS: 0,
    FGM: 0,
    FGA: 0,
    threePM: 0,
    threePA: 0,
    twoPM: 0,
    twoPA: 0,
    FTM: 0,
    FTA: 0,
    OREB: 0,
    DREB: 0,
    TRB: 0,
    AST: 0,
    STL: 0,
    BLK: 0,
    TOV: 0,
    PF: 0,
    FD: 0,
    plusMinus: 0
  });
}

function validateTeamRows(rows: StatRow[], teamName: string, finalPoints: number, issues: string[], warnings: string[]) {
  const enteredRows = rows.filter((row) => row.name.trim());
  const teamTotals = totals(enteredRows);
  enteredRows.forEach((row) => {
    if (!parseMinutesToSeconds(row.MIN)) {
      if (row.MIN.trim() !== "00:00" && row.MIN.trim() !== "0:00") issues.push(`${row.name}: MIN must use mm:ss format.`);
    }
    if (toInt(row.FGM) > toInt(row.FGA)) issues.push(`${row.name}: FGM cannot exceed FGA.`);
    if (toInt(row.threePM) > toInt(row.threePA)) issues.push(`${row.name}: 3PM cannot exceed 3PA.`);
    if (toInt(row.twoPM) > toInt(row.twoPA)) issues.push(`${row.name}: 2PM cannot exceed 2PA.`);
    if (toInt(row.FTM) > toInt(row.FTA)) issues.push(`${row.name}: FTM cannot exceed FTA.`);
    if (toInt(row.TRB) !== toInt(row.OREB) + toInt(row.DREB)) warnings.push(`${row.name}: TRB should equal OREB + DREB and will be auto-calculated when saved.`);
  });
  if (finalPoints <= 0) issues.push(`${teamName || "Team"}: quarter scores must calculate to a final score greater than 0.`);
  if (teamTotals.PTS !== finalPoints) issues.push(`${teamName || "Team"}: player PTS total ${teamTotals.PTS}; calculated final score is ${finalPoints}.`);
  return teamTotals;
}

function validate(details: GameDetails, homeRows: StatRow[], awayRows: StatRow[]) {
  const issues: string[] = [];
  const warnings: string[] = [];
  const required: Array<[keyof GameDetails, string]> = [
    ["leagueName", "League name"],
    ["season", "Season"],
    ["seasonYear", "Season year"],
    ["gameNumber", "Game number"],
    ["gameDate", "Game date"],
    ["homeTeamName", "Home team"],
    ["awayTeamName", "Away team"],
    ["city", "City"],
    ["region", "Region"]
  ];

  required.forEach(([key, label]) => {
    if (!String(details[key]).trim()) issues.push(`${label} is required.`);
  });

  const enteredHomeRows = homeRows.filter((row) => row.name.trim());
  const enteredAwayRows = awayRows.filter((row) => row.name.trim());
  if (!enteredHomeRows.length) issues.push("Add at least one home player stat row.");
  if (!enteredAwayRows.length) issues.push("Add at least one away player stat row.");

  const homeScore = finalScore(details, "home");
  const awayScore = finalScore(details, "away");
  const homeTotals = validateTeamRows(homeRows, details.homeTeamName, homeScore, issues, warnings);
  const awayTotals = validateTeamRows(awayRows, details.awayTeamName, awayScore, issues, warnings);

  return { issues, warnings, homeScore, awayScore, homeTotals, awayTotals };
}

function matchSuggestions(value: string, gender: "BOYS" | "GIRLS", suggestions: PlayerSuggestion[]) {
  const query = value.trim().toLowerCase();
  if (query.length < 2) return [];
  return suggestions
    .filter((player) => player.displayName.toLowerCase().includes(query))
    .sort((left, right) => Number(right.gender === gender) - Number(left.gender === gender) || left.displayName.localeCompare(right.displayName))
    .slice(0, 5);
}

export function LiveStatsClient({
  showAdminHome = false,
  errorMessage,
  playerSuggestions = [],
  submissionsHref = "/organizer/submissions",
  embedded = false
}: {
  showAdminHome?: boolean;
  errorMessage?: string;
  playerSuggestions?: PlayerSuggestion[];
  submissionsHref?: string;
  embedded?: boolean;
}) {
  const currentYear = new Date().getFullYear();
  const [details, setDetails] = useState<GameDetails>({
    leagueName: "",
    ageGroup: "U16",
    gender: "BOYS",
    season: `Season ${currentYear}`,
    seasonYear: String(currentYear),
    gameNumber: "",
    gameDate: new Date().toISOString().slice(0, 10),
    homeTeamName: "",
    awayTeamName: "",
    homeQ1: "0",
    homeQ2: "0",
    homeQ3: "0",
    homeQ4: "0",
    homeOT: "0",
    awayQ1: "0",
    awayQ2: "0",
    awayQ3: "0",
    awayQ4: "0",
    awayOT: "0",
    city: "",
    region: "NCR"
  });
  const [homeRows, setHomeRows] = useState<StatRow[]>([emptyRow(1), emptyRow(2), emptyRow(3), emptyRow(4), emptyRow(5)]);
  const [awayRows, setAwayRows] = useState<StatRow[]>([emptyRow(1), emptyRow(2), emptyRow(3), emptyRow(4), emptyRow(5)]);
  const [activeTeam, setActiveTeam] = useState<ActiveTeam>("home");
  const [workflowStep, setWorkflowStep] = useState<"setup" | "scores" | "roster" | "review">("setup");
  const [showShootingDetails, setShowShootingDetails] = useState(false);
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  const validation = useMemo(() => validate(details, homeRows, awayRows), [details, homeRows, awayRows]);
  const payload = useMemo(() => JSON.stringify(buildPayload(details, homeRows, awayRows)), [details, homeRows, awayRows]);
  const visibleStatColumns = useMemo(
    () => [
      ...coreStatColumns,
      ...(showShootingDetails ? shootingDetailColumns : []),
      ...(showAdvancedStats ? advancedStatColumns : [])
    ],
    [showShootingDetails, showAdvancedStats]
  );
  const shellClass = embedded ? "grid gap-4 px-4 py-5 sm:px-6 lg:px-7" : "container-px grid gap-6 pb-16";
  const panelClass = embedded ? "rounded-lg border border-surface-200 bg-white p-4 shadow-sm" : "rounded-lg border border-surface-200 bg-white p-6 shadow-sm";
  const sectionTitleClass = embedded ? "mt-1 font-display text-2xl text-navy-800" : "mt-2 font-display text-3xl text-navy-800";

  function updateDetails(key: keyof GameDetails, value: string) {
    setDetails((current) => ({ ...current, [key]: value }));
  }

  function updateRow(rows: StatRow[], setRows: (rows: StatRow[]) => void, id: number, key: keyof StatRow, value: string | boolean) {
    setRows(rows.map((row) => {
      if (row.id !== id) return row;
      const next = { ...row, [key]: value };
      if (key === "OREB" || key === "DREB") {
        next.TRB = String(toInt(next.OREB) + toInt(next.DREB));
      }
      return next;
    }));
  }

  function addRows(rows: StatRow[], setRows: (rows: StatRow[]) => void, count: number) {
    const lastId = rows.reduce((max, row) => Math.max(max, row.id), 0);
    setRows([...rows, ...Array.from({ length: count }, (_, index) => emptyRow(lastId + index + 1))]);
  }

  const content = (
      <section className={shellClass}>
        <div className={embedded ? "rounded-lg border border-surface-200 bg-white p-4 shadow-sm" : "rounded-lg bg-navy-800 p-6 text-white shadow-panel"}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={`inline-flex items-center gap-2 font-mono text-label uppercase tracking-[0.12em] ${embedded ? "text-amber-600" : "text-amber-400"}`}>
                <Activity className="h-4 w-4" aria-hidden="true" />
                Manual Stats Entry
              </p>
              <h1 className={embedded ? "mt-1 font-display text-3xl text-navy-800 md:text-4xl" : "mt-3 font-display text-stat-md"}>Manual Stats Entry</h1>
              <p className={embedded ? "mt-1 max-w-2xl text-sm text-ink-600" : "mt-3 max-w-2xl text-navy-200"}>Save game box score as draft</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {showAdminHome && !embedded ? <Link href="/admin" className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-navy-800 hover:bg-amber-100">Admin Home</Link> : null}
              <Link href={submissionsHref} className={embedded ? "rounded-md border border-surface-200 px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-surface-100" : "rounded-md bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"}>Back to Submissions</Link>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <AdminAlert variant="error" size="sm" className="rounded-md">
            {errorMessage}
          </AdminAlert>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {([
            ["setup", "1. Game setup"],
            ["scores", "2. Team scores"],
            ["roster", "3. Roster lines"],
            ["review", "4. Review"]
          ] as const).map(([step, label]) => (
            <button
              key={step}
              type="button"
              onClick={() => setWorkflowStep(step)}
              className={`rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] ${workflowStep === step ? "border-navy-900 bg-navy-900 text-white" : "border-surface-300 bg-white text-ink-700"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <form action={createManualStatsSubmission} className={embedded ? "grid gap-4" : "grid gap-6"}>
          {submissionsHref.startsWith("/admin") ? <input type="hidden" name="returnTo" value="/admin/tools/live-stats" /> : null}
          <input type="hidden" name="manualSubmissionPayload" value={payload} />

          {(workflowStep === "roster" || workflowStep === "review") ? (
          <LiveStatsWorkHeader
            details={details}
            validation={validation}
            activeTeam={activeTeam}
            onActiveTeamChange={setActiveTeam}
            homeRowCount={homeRows.length}
            awayRowCount={awayRows.length}
            showShootingDetails={showShootingDetails}
            onShowShootingDetailsChange={setShowShootingDetails}
            showAdvancedStats={showAdvancedStats}
            onShowAdvancedStatsChange={setShowAdvancedStats}
            compact={embedded}
          />
          ) : null}

          {(workflowStep === "setup" || workflowStep === "review") ? (
          <section className={panelClass}>
            <p className="label">1. Game Details</p>
            <div className={embedded ? "mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4" : "mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4"}>
              <TextInput label="League name" value={details.leagueName} onChange={(value) => updateDetails("leagueName", value)} placeholder="UAAP Season 88 16U Boys Basketball" />
              <SelectInput label="Age group" value={details.ageGroup} onChange={(value) => updateDetails("ageGroup", value)} options={["U13", "U16", "U19"]} />
              <SelectInput label="Gender" value={details.gender} onChange={(value) => updateDetails("gender", value)} options={["BOYS", "GIRLS"]} />
              <TextInput label="Season" value={details.season} onChange={(value) => updateDetails("season", value)} placeholder="Season 88" />
              <TextInput label="Season year" type="number" value={details.seasonYear} onChange={(value) => updateDetails("seasonYear", value)} />
              <TextInput label="Game number" value={details.gameNumber} onChange={(value) => updateDetails("gameNumber", value)} placeholder="Game 1" />
              <TextInput label="Game date" type="date" value={details.gameDate} onChange={(value) => updateDetails("gameDate", value)} />
              <TextInput label="City" value={details.city} onChange={(value) => updateDetails("city", value)} />
              <TextInput label="Region" value={details.region} onChange={(value) => updateDetails("region", value)} />
            </div>
          </section>
          ) : null}

          {(workflowStep === "scores" || workflowStep === "review") ? (
          <section className={panelClass}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="label">2. Team Scores</p>
                <h2 className={sectionTitleClass}>{details.homeTeamName || "Home"} {validation.homeScore} - {validation.awayScore} {details.awayTeamName || "Away"}</h2>
              </div>
              <p className="max-w-xl text-sm text-ink-600">Enter quarter scores. Final scores are calculated automatically and checked against player point totals.</p>
            </div>
            <div className={embedded ? "mt-4 grid gap-4 lg:grid-cols-2" : "mt-5 grid gap-5 lg:grid-cols-2"}>
              <QuarterScoreFields label="Home team" teamName={details.homeTeamName} onTeamName={(value) => updateDetails("homeTeamName", value)} values={[details.homeQ1, details.homeQ2, details.homeQ3, details.homeQ4, details.homeOT]} onChange={(key, value) => updateDetails(key, value)} keys={["homeQ1", "homeQ2", "homeQ3", "homeQ4", "homeOT"]} finalScore={validation.homeScore} />
              <QuarterScoreFields label="Away team" teamName={details.awayTeamName} onTeamName={(value) => updateDetails("awayTeamName", value)} values={[details.awayQ1, details.awayQ2, details.awayQ3, details.awayQ4, details.awayOT]} onChange={(key, value) => updateDetails(key, value)} keys={["awayQ1", "awayQ2", "awayQ3", "awayQ4", "awayOT"]} finalScore={validation.awayScore} />
            </div>
          </section>
          ) : null}

          {(workflowStep === "roster" || workflowStep === "review") ? (
          activeTeam === "home" ? (
            <TeamStatSection
              title="Home Team Player Stats"
              teamName={details.homeTeamName || "Home team"}
              rows={homeRows}
              setRows={setHomeRows}
              totals={validation.homeTotals}
              gender={details.gender}
              playerSuggestions={playerSuggestions}
              addOneLabel="Add home player row"
              addFiveLabel="Add 5 home rows"
              onAdd={(count) => addRows(homeRows, setHomeRows, count)}
              onUpdate={(id, key, value) => updateRow(homeRows, setHomeRows, id, key, value)}
              visibleColumns={visibleStatColumns}
              compact={embedded}
            />
          ) : (
            <TeamStatSection
              title="Away Team Player Stats"
              teamName={details.awayTeamName || "Away team"}
              rows={awayRows}
              setRows={setAwayRows}
              totals={validation.awayTotals}
              gender={details.gender}
              playerSuggestions={playerSuggestions}
              addOneLabel="Add away player row"
              addFiveLabel="Add 5 away rows"
              onAdd={(count) => addRows(awayRows, setAwayRows, count)}
              onUpdate={(id, key, value) => updateRow(awayRows, setAwayRows, id, key, value)}
              visibleColumns={visibleStatColumns}
              compact={embedded}
            />
          )
          ) : null}
        </form>
      </section>
  );

  if (embedded) return content;

  return <main className="min-h-screen bg-surface-50 pt-28">{content}</main>;
}

function LiveStatsWorkHeader({
  details,
  validation,
  activeTeam,
  onActiveTeamChange,
  homeRowCount,
  awayRowCount,
  showShootingDetails,
  onShowShootingDetailsChange,
  showAdvancedStats,
  onShowAdvancedStatsChange,
  compact
}: {
  details: GameDetails;
  validation: ReturnType<typeof validate>;
  activeTeam: ActiveTeam;
  onActiveTeamChange: (team: ActiveTeam) => void;
  homeRowCount: number;
  awayRowCount: number;
  showShootingDetails: boolean;
  onShowShootingDetailsChange: (value: boolean) => void;
  showAdvancedStats: boolean;
  onShowAdvancedStatsChange: (value: boolean) => void;
  compact: boolean;
}) {
  const homeName = details.homeTeamName || "Home";
  const awayName = details.awayTeamName || "Away";
  const activeButtonClass = "border-navy-900 bg-navy-900 text-white";
  const inactiveButtonClass = "border-surface-300 bg-white text-ink-700 hover:border-orange-400 hover:text-orange-700";
  const tierButtonClass = "rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-[0.08em]";

  return (
    <section className={`sticky ${compact ? "top-16" : "top-24"} z-30 rounded-lg border border-navy-200 bg-white/95 p-3 shadow-lg backdrop-blur`}>
      <div className="grid gap-3 xl:grid-cols-[1fr_auto] xl:items-start">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[0.65rem] font-bold uppercase tracking-[0.12em] text-orange-700">Manual Stats Entry</p>
              <h2 className="mt-1 font-display text-2xl leading-tight text-navy-900">
                {homeName} {validation.homeScore} - {validation.awayScore} {awayName}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Active team roster">
              {(["home", "away"] as const).map((team) => {
                const active = activeTeam === team;
                const label = team === "home" ? homeName : awayName;
                const rowCount = team === "home" ? homeRowCount : awayRowCount;
                return (
                  <button
                    key={team}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onActiveTeamChange(team)}
                    className={`rounded-md border px-3 py-2 text-sm font-semibold ${active ? activeButtonClass : inactiveButtonClass}`}
                  >
                    {team === "home" ? "Home" : "Away"} <span className={active ? "text-white/70" : "text-ink-500"}>{label} ({rowCount})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <ScoreMatch label={homeName} points={validation.homeTotals.PTS} expected={validation.homeScore} compact />
            <ScoreMatch label={awayName} points={validation.awayTotals.PTS} expected={validation.awayScore} compact />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-green-800">Core visible</span>
            <button
              type="button"
              aria-pressed={showShootingDetails}
              onClick={() => onShowShootingDetailsChange(!showShootingDetails)}
              className={`${tierButtonClass} ${showShootingDetails ? activeButtonClass : inactiveButtonClass}`}
            >
              {showShootingDetails ? "Hide" : "Show"} Shooting Details
            </button>
            <button
              type="button"
              aria-pressed={showAdvancedStats}
              onClick={() => onShowAdvancedStatsChange(!showAdvancedStats)}
              className={`${tierButtonClass} ${showAdvancedStats ? activeButtonClass : inactiveButtonClass}`}
            >
              {showAdvancedStats ? "Hide" : "Show"} Advanced
            </button>
          </div>
        </div>

        <div className="grid min-w-64 gap-2">
          {validation.issues.length ? (
            <details className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <summary className="cursor-pointer font-semibold">Fix before saving ({validation.issues.length})</summary>
              <ul className="mt-2 grid max-h-36 gap-1 overflow-y-auto list-disc pl-5">
                {validation.issues.map((issue, index) => <li key={`${issue}:${index}`}>{issue}</li>)}
              </ul>
            </details>
          ) : (
            <p className="rounded-md border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">Ready to save as a submission draft.</p>
          )}
          {validation.warnings.length ? (
            <details className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <summary className="cursor-pointer font-semibold">Warnings ({validation.warnings.length})</summary>
              <ul className="mt-2 grid max-h-28 gap-1 overflow-y-auto list-disc pl-5">
                {validation.warnings.map((warning, index) => <li key={`${warning}:${index}`}>{warning}</li>)}
              </ul>
            </details>
          ) : null}
          <AdminSaveButton label="Save Manual Submission Draft" className="w-fit" disabled={validation.issues.length > 0} />
        </div>
      </div>
    </section>
  );
}

function TeamStatSection({
  title,
  teamName,
  rows,
  setRows,
  totals: teamTotals,
  gender,
  playerSuggestions,
  addOneLabel,
  addFiveLabel,
  onAdd,
  onUpdate,
  visibleColumns,
  compact = false
}: {
  title: string;
  teamName: string;
  rows: StatRow[];
  setRows: (rows: StatRow[]) => void;
  totals: TeamTotals;
  gender: "BOYS" | "GIRLS";
  playerSuggestions: PlayerSuggestion[];
  addOneLabel: string;
  addFiveLabel: string;
  onAdd: (count: number) => void;
  onUpdate: (id: number, key: keyof StatRow, value: string | boolean) => void;
  visibleColumns: StatColumn[];
  compact?: boolean;
}) {
  const tableMinWidth = visibleColumns.length <= coreStatColumns.length
    ? "min-w-[82rem]"
    : visibleColumns.length <= coreStatColumns.length + shootingDetailColumns.length
      ? "min-w-[104rem]"
      : "min-w-[112rem]";
  const stickyHeaderClass = compact ? "bg-navy-900 text-white" : "bg-surface-100 text-surface-600";
  const statInputWidth = compact ? "w-16" : "w-20";

  return (
    <section className={`rounded-lg border border-surface-200 bg-white shadow-sm ${compact ? "p-4" : "p-6"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label">3. Active Team Stats</p>
          <h2 className={`${compact ? "mt-1 text-2xl" : "mt-2 text-3xl"} font-display text-navy-800`}>{title}</h2>
          <p className="mt-1 text-sm text-ink-600">
            {compact ? `Assigned to ${teamName}. New player names create profiles when published.` : `Rows in this section are assigned to ${teamName}. New player names will create new player profiles when published.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`button secondary ${compact ? "min-h-10 px-3 py-2 text-sm" : ""}`} onClick={() => onAdd(1)}><Plus className="h-4 w-4" aria-hidden="true" /> {addOneLabel}</button>
          <button type="button" className={`button secondary ${compact ? "min-h-10 px-3 py-2 text-sm" : ""}`} onClick={() => onAdd(5)}>{addFiveLabel}</button>
        </div>
      </div>

      <div className={`${compact ? "mt-4" : "mt-5"} overflow-x-auto rounded-lg border border-surface-200`}>
        <table className={`w-full ${tableMinWidth} text-left text-sm`}>
          <thead className={`sticky top-0 z-10 ${stickyHeaderClass} font-mono text-mono-sm uppercase`}>
            <tr>
              <th className={`sticky left-0 top-0 z-30 w-20 min-w-[5rem] border-r border-surface-200 px-2 py-2 ${stickyHeaderClass}`}>Starter</th>
              <th className={`sticky left-20 top-0 z-30 w-56 min-w-[14rem] border-r border-surface-200 px-2 py-2 ${stickyHeaderClass}`}>Player Name</th>
              {visibleColumns.map((column) => <th key={column.key} className="px-2 py-2">{column.label}</th>)}
              <th className="px-2 py-2">Remove</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-surface-200 align-top">
                <td className="sticky left-0 z-20 w-20 min-w-[5rem] border-r border-surface-200 bg-white px-2 py-2"><input type="checkbox" checked={row.starter} onChange={(event) => onUpdate(row.id, "starter", event.target.checked)} /></td>
                <td className="sticky left-20 z-20 w-56 min-w-[14rem] border-r border-surface-200 bg-white px-2 py-2">
                  <PlayerNameInput row={row} gender={gender} suggestions={playerSuggestions} onChange={(value) => onUpdate(row.id, "name", value)} />
                </td>
                {visibleColumns.map((column) => (
                  <td key={column.key} className="px-2 py-2">
                    <input
                      value={String(row[column.key] ?? "")}
                      onChange={(event) => onUpdate(row.id, column.key, event.target.value)}
                      type={column.key === "MIN" ? "text" : "number"}
                      inputMode={column.key === "MIN" ? "text" : "numeric"}
                      className={`${column.width ?? statInputWidth} min-h-9 rounded-md border border-surface-200 px-2 py-1`}
                      placeholder={column.key === "MIN" ? "00:00" : undefined}
                    />
                  </td>
                ))}
                <td className="px-2 py-2">
                  <button type="button" className="rounded-md p-2 text-ink-500 hover:bg-red-50 hover:text-red-700" onClick={() => setRows(rows.filter((item) => item.id !== row.id))} aria-label="Remove row">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-t border-navy-200 bg-navy-50 font-semibold text-navy-900">
              <td className="sticky left-0 z-20 w-20 min-w-[5rem] border-r border-surface-200 bg-navy-50 px-2 py-3 font-mono text-[0.65rem] uppercase">Total</td>
              <td className="sticky left-20 z-20 w-56 min-w-[14rem] border-r border-surface-200 bg-navy-50 px-2 py-3">Team Totals</td>
              {visibleColumns.map((column) => <td key={`total:${column.key}`} className="px-2 py-3">{teamTotals[column.key]}</td>)}
              <td className="px-2 py-3" />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlayerNameInput({ row, gender, suggestions, onChange }: { row: StatRow; gender: "BOYS" | "GIRLS"; suggestions: PlayerSuggestion[]; onChange: (value: string) => void }) {
  const matches = matchSuggestions(row.name, gender, suggestions);
  return (
    <span className="relative block">
      <input value={row.name} onChange={(event) => onChange(event.target.value)} className="min-h-9 w-full rounded-md border border-surface-200 px-2 py-1" placeholder="Full name" />
      {matches.length ? (
        <span className="absolute left-0 top-full z-40 mt-1 grid w-72 rounded-md border border-surface-200 bg-white p-2 shadow-panel">
          {matches.map((player) => (
            <button key={player.id} type="button" onClick={() => onChange(player.displayName)} className="rounded px-2 py-1 text-left text-sm hover:bg-amber-50">
              <strong className="block text-ink-900">{player.displayName}</strong>
              <small className="text-ink-500">{player.gender} - {player.city}, {player.region}</small>
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}

function ScoreMatch({ label, points, expected, compact = false }: { label: string; points: number; expected: number; compact?: boolean }) {
  const pass = points === expected && expected > 0;
  return (
    <p className={`${compact ? "" : "mt-4"} rounded-md p-3 text-sm font-semibold ${pass ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
      {label}: player PTS {points} / calculated score {expected} - {pass ? "Matched" : "Needs review"}
    </p>
  );
}

function QuarterScoreFields({ label, teamName, onTeamName, values, keys, onChange, finalScore }: { label: string; teamName: string; onTeamName: (value: string) => void; values: string[]; keys: Array<keyof GameDetails>; onChange: (key: keyof GameDetails, value: string) => void; finalScore: number }) {
  return (
    <div className="rounded-md border border-surface-200 p-4">
      <TextInput label={label} value={teamName} onChange={onTeamName} />
      <div className="mt-3 grid grid-cols-5 gap-2">
        {["Q1", "Q2", "Q3", "Q4", "OT"].map((quarter, index) => (
          <TextInput key={quarter} label={quarter} type="number" value={values[index]} onChange={(value) => onChange(keys[index], value)} />
        ))}
      </div>
      <p className="mt-3 rounded-md bg-surface-100 p-3 text-sm"><strong className="text-navy-800">Final:</strong> {finalScore}</p>
    </div>
  );
}

function TextInput({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-surface-700">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} type={type} placeholder={placeholder} className="min-h-11 rounded-md border border-surface-200 px-3 py-2" />
    </label>
  );
}

function SelectInput({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-surface-700">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="min-h-11 rounded-md border border-surface-200 px-3 py-2">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

