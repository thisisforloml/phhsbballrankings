"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PlayerProfile, PlayerProfileAverages, PlayerProfileGame } from "@/lib/player-profile-types";
import type { CompetitionParticipationSummary } from "@/lib/player-competition-context";
import type { LeagueHistory } from "@/lib/mock-data";
import { getProgramAbbreviation } from "@/lib/uaap-school-display";
import { ProfileModule } from "@/components/public/ProfileModule";
import { LineTrendChart } from "@/components/public/charts/ProfileCharts";
import { metricHelp } from "@/lib/metric-explanations";
import { HorizontalBarChart } from "@/components/public/charts/ProfileCharts";
import { SortIndicator } from "@/components/public/SortIndicator";
import { EmptyState, WinLossPill } from "@/components/ui";

type GameLogResultFilter = "ALL" | "W" | "L";
type GameLogSort =
  | "date" | "opponent" | "result" | "minutes"
  | "points" | "rebounds" | "assists" | "steals" | "blocks"
  | "turnovers" | "fouls" | "fieldGoals" | "twoPoints"
  | "threePoints" | "freeThrows" | "plusMinus";
type SortDirection = "asc" | "desc";

// ── shared helpers ────────────────────────────────────────────────────────────

function statValue(value: number | string | null) {
  return value === null || value === "" ? "-" : value;
}

function pct(value: number | null) {
  return value === null ? "-" : `${value}%`;
}

function madeAttempt(made: number | null, attempt: number | null) {
  if (made === null && attempt === null) return "-";
  return `${made ?? 0}/${attempt ?? 0}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

function compactTeamName(value: string) {
  const abbr = getProgramAbbreviation(value).trim();
  return abbr.length && abbr.length < value.trim().length ? abbr : value;
}

function ratio(made: number | null, attempt: number | null) {
  if (!attempt) return 0;
  return (made ?? 0) / attempt;
}

function descendingDefault(sort: GameLogSort) {
  return !["opponent", "result"].includes(sort);
}

function sumNullable(games: PlayerProfileGame[], getValue: (g: PlayerProfileGame) => number | null) {
  return games.reduce((sum, g) => sum + (getValue(g) ?? 0), 0);
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function shootingPercentage(made: number, attempt: number) {
  if (!attempt) return null;
  return roundOne((made / attempt) * 100);
}

type TotalsSlice = {
  id: string;
  label: string;
  group: "Career" | "Year" | "League";
  games: PlayerProfileGame[];
};

function buildTotalsSlices(games: PlayerProfileGame[]): TotalsSlice[] {
  if (!games.length) return [];

  const slices: TotalsSlice[] = [
    { id: "career", label: "Career", group: "Career", games },
  ];

  const byYear = new Map<number, PlayerProfileGame[]>();
  for (const game of games) {
    const year = new Date(game.gameDate).getUTCFullYear();
    const bucket = byYear.get(year) ?? [];
    bucket.push(game);
    byYear.set(year, bucket);
  }
  for (const year of [...byYear.keys()].sort((a, b) => b - a)) {
    slices.push({
      id: `year-${year}`,
      label: String(year),
      group: "Year",
      games: byYear.get(year) ?? [],
    });
  }

  const byLeague = new Map<string, PlayerProfileGame[]>();
  for (const game of games) {
    const key = `${game.leagueName}::${game.seasonName}`;
    const bucket = byLeague.get(key) ?? [];
    bucket.push(game);
    byLeague.set(key, bucket);
  }
  for (const [key, leagueGames] of [...byLeague.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const sample = leagueGames[0];
    slices.push({
      id: `league-${key}`,
      label: `${sample.leagueName} · ${sample.seasonName}`,
      group: "League",
      games: leagueGames,
    });
  }

  return slices;
}

function buildTotalsRows(games: PlayerProfileGame[]): Array<[string, string | number]> {
  const totalMinutes = sumNullable(games, (g) => g.minutes);
  return [
    ["GP", games.length],
    ["MIN", totalMinutes ? Math.round(totalMinutes) : "—"],
    ["PTS", sumNullable(games, (g) => g.points)],
    ["REB", sumNullable(games, (g) => g.rebounds)],
    ["AST", sumNullable(games, (g) => g.assists)],
    ["STL", sumNullable(games, (g) => g.steals)],
    ["BLK", sumNullable(games, (g) => g.blocks)],
    ["TOV", sumNullable(games, (g) => g.turnovers)],
    ["PF", sumNullable(games, (g) => g.fouls)],
  ];
}

function buildSliceAverages(games: PlayerProfileGame[]) {
  if (!games.length) return null;
  const minutesGames = games.filter((game) => game.minutes !== null).length;
  const plusMinusGames = games.filter((game) => game.plusMinus !== null).length;
  return {
    ppg: roundOne(sumNullable(games, (g) => g.points) / games.length),
    rpg: roundOne(sumNullable(games, (g) => g.rebounds) / games.length),
    apg: roundOne(sumNullable(games, (g) => g.assists) / games.length),
    mpg: minutesGames ? roundOne(sumNullable(games, (g) => g.minutes) / minutesGames) : null,
    spg: roundOne(sumNullable(games, (g) => g.steals) / games.length),
    bpg: roundOne(sumNullable(games, (g) => g.blocks) / games.length),
    plusMinus: plusMinusGames ? roundOne(sumNullable(games, (g) => g.plusMinus) / plusMinusGames) : null,
  };
}

function buildSliceShootingRows(games: PlayerProfileGame[]) {
  const totals = {
    fgm: sumNullable(games, (g) => g.fieldGoalsMade),
    fga: sumNullable(games, (g) => g.fieldGoalsAttempt),
    twoMade: sumNullable(games, (g) => g.twoMade),
    twoAttempt: sumNullable(games, (g) => g.twoAttempt),
    threeMade: sumNullable(games, (g) => g.threeMade),
    threeAttempt: sumNullable(games, (g) => g.threeAttempt),
    ftm: sumNullable(games, (g) => g.freeThrowsMade),
    fta: sumNullable(games, (g) => g.freeThrowsAttempt),
    points: sumNullable(games, (g) => g.points),
  };
  const trueShootingDenominator = 2 * (totals.fga + 0.44 * totals.fta);
  const shooting = {
    fieldGoalPct: shootingPercentage(totals.fgm, totals.fga),
    twoPointPct: shootingPercentage(totals.twoMade, totals.twoAttempt),
    threePointPct: shootingPercentage(totals.threeMade, totals.threeAttempt),
    freeThrowPct: shootingPercentage(totals.ftm, totals.fta),
    effectiveFieldGoalPct: totals.fga ? roundOne(((totals.fgm + 0.5 * totals.threeMade) / totals.fga) * 100) : null,
    trueShootingPct: trueShootingDenominator ? roundOne((totals.points / trueShootingDenominator) * 100) : null,
  };

  return [
    { label: "FG%", value: shooting.fieldGoalPct, detail: `${totals.fgm}/${totals.fga}`, hasInput: totals.fga > 0 },
    { label: "2P%", value: shooting.twoPointPct, detail: `${totals.twoMade}/${totals.twoAttempt}`, hasInput: totals.twoAttempt > 0 },
    { label: "3P%", value: shooting.threePointPct, detail: `${totals.threeMade}/${totals.threeAttempt}`, hasInput: totals.threeAttempt > 0 },
    { label: "FT%", value: shooting.freeThrowPct, detail: `${totals.ftm}/${totals.fta}`, hasInput: totals.fta > 0 },
    { label: "eFG%", value: shooting.effectiveFieldGoalPct, detail: "Adjusted for threes", hasInput: totals.fga > 0 },
    { label: "TS%", value: shooting.trueShootingPct, detail: "True shooting", hasInput: totals.fga + totals.fta > 0 },
  ].filter((row) => row.hasInput);
}

function buildSliceAdvancedMetrics(games: PlayerProfileGame[]) {
  if (!games.length) return [];
  const averages = buildSliceAverages(games);
  const shootingRows = buildSliceShootingRows(games);
  const shooting = {
    effectiveFieldGoalPct: shootingRows.find((row) => row.label === "eFG%")?.value ?? null,
    trueShootingPct: shootingRows.find((row) => row.label === "TS%")?.value ?? null,
  };
  const totalMinutes = sumNullable(games, (g) => g.minutes);
  const totalAssists = sumNullable(games, (g) => g.assists);
  const totalTurnovers = sumNullable(games, (g) => g.turnovers);
  const metrics: Array<{ label: string; value: string; description: string }> = [];

  if (shooting.effectiveFieldGoalPct !== null) {
    metrics.push({ label: "eFG%", value: `${shooting.effectiveFieldGoalPct}%`, description: "Box-score estimate using FGM, 3PM, and FGA." });
  }
  if (shooting.trueShootingPct !== null) {
    metrics.push({ label: "TS%", value: `${shooting.trueShootingPct}%`, description: "Box-score estimate using PTS, FGA, and FTA." });
  }
  if (totalTurnovers > 0) {
    metrics.push({ label: "AST/TO", value: roundOne(totalAssists / totalTurnovers).toString(), description: "Assist-to-turnover ratio." });
  }
  if (totalMinutes > 0) {
    metrics.push({ label: "PTS/MIN", value: roundOne(sumNullable(games, (g) => g.points) / totalMinutes).toString(), description: "Points per minute played." });
    metrics.push({ label: "REB/MIN", value: roundOne(sumNullable(games, (g) => g.rebounds) / totalMinutes).toString(), description: "Rebounds per minute played." });
  }
  if (averages) {
    metrics.push({ label: "STL+BLK", value: roundOne(averages.spg + averages.bpg).toString(), description: "Steals plus blocks per game." });
  }
  return metrics;
}

// ── Production tab icons ──────────────────────────────────────────────────────

type SvgProps = { className?: string };

function IcCalendar({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className} aria-hidden="true">
      <rect x="2.5" y="4.5" width="15" height="13" rx="1.5" />
      <path d="M6.5 2.5v4M13.5 2.5v4M2.5 8.5h15" />
    </svg>
  );
}
function IcClock({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6v4.5l3 2" />
    </svg>
  );
}
function IcBall({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M3 10h14M10 2.5c-2.5 2-2.5 5-2.5 7.5s0 5.5 2.5 7.5M10 2.5c2.5 2 2.5 5 2.5 7.5s0 5.5-2.5 7.5" />
    </svg>
  );
}
function IcBars({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <rect x="2" y="10" width="3.5" height="8" rx="0.5" />
      <rect x="7.5" y="6" width="3.5" height="12" rx="0.5" />
      <rect x="13" y="2" width="3.5" height="16" rx="0.5" />
    </svg>
  );
}
function IcPlay({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M5.5 3.5l11 6.5-11 6.5V3.5z" />
    </svg>
  );
}
function IcTarget({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" />
      <circle cx="10" cy="10" r="3.5" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IcHand({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M10 3v8M7 5v6M13 5v6M4 9.5v3.5a6 6 0 0012 0V9.5" />
    </svg>
  );
}
function IcShield({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M10 2l7 3v5c0 4-3.5 7-7 8-3.5-1-7-4-7-8V5l7-3z" />
    </svg>
  );
}
function IcRotate({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4.5 10a5.5 5.5 0 001 3M15.5 10a5.5 5.5 0 01-1 3M14.5 3.5A8 8 0 003 10M5.5 16.5A8 8 0 0017 10" />
      <path d="M3 13.5v3.5H6.5M17 13v4h-3.5" />
    </svg>
  );
}
function IcFlag({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M4 3v14M4 3l12 4-12 4" />
    </svg>
  );
}
function IcStar({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M10 1.5l2.4 7.1H19l-5.5 4 2.1 6.6L10 15.2l-5.6 4 2.1-6.6L1 8.6h6.6z" />
    </svg>
  );
}
function IcLightning({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M11 2L4 11h6l-1 7 7-9h-6z" />
    </svg>
  );
}
function IcArrows({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M10 3v14M6 6l4-4 4 4M6 14l4 4 4-4" />
    </svg>
  );
}
function IcCheck({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="8" />
      <path d="M6 10l3 3 5-5" />
    </svg>
  );
}
function IcTrophy({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M6 2h8v6a4 4 0 01-8 0V2zM4 3H2a2 2 0 000 4h2M16 3h2a2 2 0 010 4h-2M10 12v4M7 18h6" />
    </svg>
  );
}
function IcFlame({ className }: SvgProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <path d="M10 18c-4.2 0-7-3-7-7 0-3.5 2.5-5.8 4-7-.5 2 .5 3.5 1.5 4-.3-1.5.5-3 1.5-3.8 0 2.5 2.5 3 2.5 5.5.5-.5 1-1.5.5-3C15 8 17 11 17 13c0 3-2.5 5-7 5z" />
    </svg>
  );
}

function StatIconFor({ label, className = "h-4 w-4" }: { label: string; className?: string }) {
  const l = label.toUpperCase();
  if (l === "GP") return <IcCalendar className={className} />;
  if (l === "MPG" || l === "MIN") return <IcClock className={className} />;
  if (l === "PPG" || l === "PTS") return <IcBall className={className} />;
  if (l === "RPG" || l === "REB") return <IcBars className={className} />;
  if (l === "APG" || l === "AST") return <IcPlay className={className} />;
  if (l === "TS%") return <IcTarget className={className} />;
  if (l === "SPG" || l === "STL") return <IcHand className={className} />;
  if (l === "BPG" || l === "BLK") return <IcShield className={className} />;
  if (l === "TOV") return <IcRotate className={className} />;
  if (l === "PF") return <IcFlag className={className} />;
  return <span className={className} />;
}

function BadgeIcon({ label }: { label: string }) {
  const l = label.toLowerCase();
  const cls = "h-3 w-3";
  if (l.includes("scorer")) return <IcStar className={cls} />;
  if (l.includes("efficient") || l.includes("producer")) return <IcLightning className={cls} />;
  if (l.includes("rebound")) return <IcArrows className={cls} />;
  if (l.includes("defensive") || l.includes("defense")) return <IcShield className={cls} />;
  if (l.includes("reliable") || l.includes("sample")) return <IcCheck className={cls} />;
  return null;
}

function PerGameStatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2.5 rounded border border-neutral-200 bg-neutral-50 px-3 py-2.5">
      <StatIconFor label={label} className="h-5 w-5 shrink-0 text-accent-600" />
      <div>
        <p className="font-display text-xl font-bold tabular-nums leading-none text-primary-900">{value}</p>
        <p className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-accent-600">{label}</p>
      </div>
    </div>
  );
}

function TotalsStatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-2 py-2.5">
      <StatIconFor label={label} className="h-4 w-4 text-accent-600" />
      <p className="font-display text-xl font-bold tabular-nums leading-none text-primary-900">{value}</p>
      <p className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-accent-600">{label}</p>
    </div>
  );
}

// ── Production tab primitives ─────────────────────────────────────────────────

function ProductionHeading({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[0.6rem] font-black uppercase tracking-[0.18em] text-accent-600">{children}</h4>;
}

// ── StatCard (game log & legacy) ──────────────────────────────────────────────

function StatCard({ label, value, helper, compact = false }: { label: string; value: string | number; helper?: string; compact?: boolean }) {
  return (
    <span className={`block border-l-2 border-hardwood-600 bg-paper-500 px-2 py-1.5 ${compact ? "min-h-0" : "min-h-[3rem]"}`}>
      <strong className={`block font-display font-bold leading-none text-court-900 ${compact ? "text-lg" : "text-xl md:text-2xl"}`}>{value}</strong>
      <small className="mt-0.5 block text-[0.62rem] font-bold uppercase tracking-[0.1em] text-hardwood-600">{label}</small>
      {helper ? <small className="mt-1 block text-[0.7rem] font-semibold leading-4 text-court-500">{helper}</small> : null}
    </span>
  );
}

// ── Season production ───────────────────────────────────────────────────────────

export function PlayerSeasonProduction({ profile }: { profile: PlayerProfile }) {
  const intelligence = profile.intelligence;
  const [expanded, setExpanded] = useState(false);

  const totalsSlices = useMemo(() => buildTotalsSlices(profile.allGames), [profile.allGames]);
  const [selectedSliceId, setSelectedSliceId] = useState("career");

  const activeSlice = useMemo(
    () => totalsSlices.find((slice) => slice.id === selectedSliceId) ?? totalsSlices[0],
    [selectedSliceId, totalsSlices]
  );

  const activeGames = activeSlice?.games ?? profile.allGames;
  const activeTotals = useMemo(() => buildTotalsRows(activeGames), [activeGames]);
  const activeSliceAverages = useMemo(() => buildSliceAverages(activeGames), [activeGames]);
  const activeShootingRows = useMemo(() => buildSliceShootingRows(activeGames), [activeGames]);
  const activeAdvancedMetrics = useMemo(() => buildSliceAdvancedMetrics(activeGames), [activeGames]);

  const coreStats: Array<[string, string | number]> = [
    ["GP", profile.averages.gamesPlayed],
    ["MPG", profile.averages.minutes ?? "—"],
    ["PPG", profile.averages.points],
    ["RPG", profile.averages.rebounds],
    ["APG", profile.averages.assists],
    ["TS%", pct(profile.shooting.trueShootingPct)],
  ];

  const secondaryStats: Array<[string, string | number]> = [
    ["SPG", profile.averages.steals],
    ["BPG", profile.averages.blocks],
    ["TOV", profile.averages.turnovers],
    ["PF", profile.averages.fouls],
    ["+/-", profile.averages.plusMinus ?? "—"],
  ];

  const bestGameLine =
    profile.bestGame &&
    [
      ["PTS", profile.bestGame.game.points],
      ["REB", profile.bestGame.game.rebounds],
      ["AST", profile.bestGame.game.assists],
      ["STL", statValue(profile.bestGame.game.steals)],
      ["BLK", statValue(profile.bestGame.game.blocks)],
    ] as Array<[string, string | number]>;

  const sliceAveragesLine = activeSliceAverages
    ? [
        `${activeSliceAverages.ppg} PPG`,
        `${activeSliceAverages.rpg} RPG`,
        `${activeSliceAverages.apg} APG`,
        activeSliceAverages.mpg !== null ? `${activeSliceAverages.mpg} MPG` : null,
        activeSliceAverages.plusMinus !== null ? `${activeSliceAverages.plusMinus} +/-` : null,
      ].filter(Boolean).join(" · ")
    : null;

  return (
    <ProfileModule id="production" title="Season Production" bodyClassName="p-0">
      {/* ── Header: primary strength + badges ── */}
      <div className="relative overflow-hidden border-b border-neutral-200 bg-primary-900 px-5 py-5 text-white md:px-6">
        <p className="text-[0.6rem] font-black uppercase tracking-[0.18em] text-accent-400">Primary strength</p>
        <h3 className="mt-1 font-display text-[clamp(1.5rem,3.5vw,2.25rem)] font-extrabold uppercase leading-[1.05] tracking-tight">
          {intelligence.roleArchetype.label}
        </h3>
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 select-none text-[5rem] opacity-10" aria-hidden="true">
          🏀
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {intelligence.strengthBadges.length ? (
            intelligence.strengthBadges.map((badge) => (
              <span
                key={badge.label}
                title={badge.reason}
                className="flex items-center gap-1.5 rounded border border-accent-400/50 bg-white/10 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-white"
              >
                <BadgeIcon label={badge.label} />
                {badge.label}
              </span>
            ))
          ) : (
            <span className="rounded border border-white/20 bg-white/10 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-white/60">
              Limited separation
            </span>
          )}
        </div>
      </div>

      {/* ── Per-game averages ── */}
      <div className="border-b border-neutral-200 px-5 py-4 md:px-6">
        <ProductionHeading>Per-game averages</ProductionHeading>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          {coreStats.map(([label, value]) => (
            <PerGameStatCell key={label as string} label={label as string} value={value} />
          ))}
        </div>
        <div className="mt-2.5 flex justify-end">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-neutral-500 hover:text-primary-900"
          >
            {expanded ? "▲ Hide" : "More stats"} (SPG · BPG · TOV · PF · +/-) →
          </button>
        </div>
        {expanded ? (
          <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-neutral-200 pt-3 sm:grid-cols-5">
            {secondaryStats.map(([label, value]) => (
              <PerGameStatCell key={label as string} label={label as string} value={value} />
            ))}
          </div>
        ) : null}
      </div>

      {/* ── Totals / Shooting / Advanced ── */}
      <div className="divide-y divide-neutral-200 xl:grid xl:grid-cols-3 xl:divide-x xl:divide-y-0">
        {profile.allGames.length > 0 && activeSlice ? (
          <section className="px-5 py-4 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ProductionHeading>Totals</ProductionHeading>
              <label className="sr-only" htmlFor="production-totals-slice">Totals scope</label>
              <select
                id="production-totals-slice"
                value={selectedSliceId}
                onChange={(event) => setSelectedSliceId(event.target.value)}
                className="max-w-full rounded border border-neutral-200 bg-white px-2 py-0.5 text-xs font-bold text-primary-900 outline-none focus:border-accent-600"
              >
                {(["Career", "Year", "League"] as const).map((group) => {
                  const options = totalsSlices.filter((slice) => slice.group === group);
                  if (!options.length) return null;
                  return (
                    <optgroup key={group} label={group}>
                      {options.map((slice) => (
                        <option key={slice.id} value={slice.id}>
                          {slice.group === "Career"
                            ? `Career (${slice.games.length} GP)`
                            : `${slice.label} (${slice.games.length} GP)`}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            {sliceAveragesLine ? (
              <p className="mt-1 text-[0.68rem] font-semibold text-neutral-400">{sliceAveragesLine}</p>
            ) : null}
            <div className="mt-3 grid grid-cols-3 gap-2">
              {activeTotals.map(([label, value]) => (
                <TotalsStatCell key={label as string} label={label as string} value={value} />
              ))}
            </div>
          </section>
        ) : null}

        {activeShootingRows.length > 0 ? (
          <section className="px-5 py-4 md:px-6">
            <ProductionHeading>Shooting profile</ProductionHeading>
            <div className="mt-3 space-y-3">
              {activeShootingRows.map((row) => (
                <div key={row.label} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-accent-600">
                    <StatIconFor label={row.label} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold leading-none text-primary-900">{row.label}</p>
                        <p className="mt-0.5 text-[0.65rem] font-semibold text-neutral-400">{row.detail}</p>
                      </div>
                      <strong className="shrink-0 font-display text-base font-bold tabular-nums text-accent-600">{pct(row.value)}</strong>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-200">
                      <div
                        className="h-full rounded-full bg-accent-600"
                        style={{ width: `${Math.max(3, Math.min(100, row.value ?? 0))}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeAdvancedMetrics.length > 0 ? (
          <section className="px-5 py-4 md:px-6">
            <ProductionHeading>Advanced metrics</ProductionHeading>
            <dl className="mt-3 space-y-3">
              {activeAdvancedMetrics.map((metric) => (
                <div key={metric.label} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm font-bold text-primary-900">{metric.label}</dt>
                    <dd className="font-display text-base font-bold tabular-nums text-accent-600">{metric.value}</dd>
                  </div>
                  <p className="mt-0.5 text-[0.65rem] font-semibold leading-4 text-neutral-400">{metric.description}</p>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </div>

      {/* ── Best game + Game highs ── */}
      <div className="divide-y divide-neutral-200 border-t border-neutral-200 xl:grid xl:grid-cols-2 xl:divide-x xl:divide-y-0">
        {profile.bestGame && bestGameLine ? (
          <section className="px-5 py-4 md:px-6">
            <div className="mb-3 flex items-center gap-2 text-accent-600">
              <IcTrophy className="h-4 w-4" />
              <ProductionHeading>Best game</ProductionHeading>
            </div>
            <Link
              href={`/games/${profile.bestGame.game.gameId}`}
              className="group block rounded border border-neutral-200 border-l-4 border-l-accent-600 hover:border-neutral-300 hover:border-l-accent-500"
            >
              <div className="flex items-center gap-3 px-4 pt-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-900 text-[0.58rem] font-black uppercase tracking-wider text-white">
                  VS
                </span>
                <div className="min-w-0">
                  <p className="font-display text-lg font-extrabold uppercase leading-tight text-primary-900 group-hover:text-accent-600">
                    {profile.bestGame.game.opponentName}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] font-semibold text-neutral-400">
                    {profile.bestGame.game.leagueName} · {formatDate(profile.bestGame.game.gameDate)}
                  </p>
                </div>
              </div>
              <p className="mt-3 flex items-center gap-1.5 px-4 text-[0.68rem] font-semibold text-neutral-500">
                <IcCalendar className="h-3.5 w-3.5 text-neutral-400" />
                FG {madeAttempt(profile.bestGame.game.fieldGoalsMade, profile.bestGame.game.fieldGoalsAttempt)}
                <span className="text-neutral-300">·</span>
                <IcRotate className="h-3.5 w-3.5 text-neutral-400" />
                3P {madeAttempt(profile.bestGame.game.threeMade, profile.bestGame.game.threeAttempt)}
                <span className="text-neutral-300">·</span>
                FT {madeAttempt(profile.bestGame.game.freeThrowsMade, profile.bestGame.game.freeThrowsAttempt)}
              </p>
              <div className="mt-3 flex divide-x divide-neutral-200 border-t border-neutral-200">
                {bestGameLine.map(([label, value]) => (
                  <div key={label as string} className="flex flex-1 flex-col items-center justify-center py-3">
                    <p className="font-display text-[1.75rem] font-bold tabular-nums leading-none text-primary-900">{value}</p>
                    <p className="mt-1.5 text-[0.58rem] font-bold uppercase tracking-[0.1em] text-accent-600">{label}</p>
                  </div>
                ))}
              </div>
            </Link>
          </section>
        ) : null}

        {profile.gameHighs.length > 0 ? (
          <section className="bg-neutral-50 px-5 py-4 md:px-6">
            <div className="mb-3 flex items-center gap-2 text-accent-600">
              <IcFlame className="h-4 w-4" />
              <ProductionHeading>Game highs</ProductionHeading>
            </div>
            <ul className="space-y-1.5">
              {profile.gameHighs.map((high) => (
                <li key={high.label} className="flex items-center gap-3 rounded border border-neutral-200 bg-white px-3 py-2">
                  <strong className="w-8 shrink-0 font-display text-2xl font-bold tabular-nums leading-none text-accent-600">
                    {high.value}
                  </strong>
                  <span className="w-16 shrink-0 text-[0.58rem] font-black uppercase tracking-[0.1em] text-neutral-400">
                    {high.label}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold text-neutral-700">
                    vs {high.opponentName}
                  </p>
                  <p className="shrink-0 text-[0.68rem] font-semibold text-neutral-400">{formatDate(high.gameDate)}</p>
                  <IcCalendar className="h-4 w-4 shrink-0 text-neutral-300" />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {profile.allGames.length > 0 ? (
        <p className="border-t border-neutral-200 px-5 py-2.5 text-[0.65rem] font-semibold text-neutral-400 md:px-6">
          ⓘ Stats are based on the selected sample of {activeGames.length} game{activeGames.length === 1 ? "" : "s"}.
        </p>
      ) : null}
    </ProfileModule>
  );
}

// ── Competition module (merged) ───────────────────────────────────────────────

export function PlayerCompetitionModule({
  profile,
  participation,
}: {
  profile: PlayerProfile;
  participation: CompetitionParticipationSummary;
}) {
  const leagues = profile.leagues;
  if (!leagues.length && !participation.totalVerifiedGames) {
    return (
      <ProfileModule id="competition" title="Competition">
        <p className="text-sm text-court-600">No verified competition games on record yet.</p>
      </ProfileModule>
    );
  }

  const multiLeague = leagues.length >= 2;

  return (
    <ProfileModule
      id="competition"
      title="Competition"
      action={
        participation.totalVerifiedGames ? (
          <span className="text-xs font-bold text-court-500">
            {participation.competitionCount} competition{participation.competitionCount === 1 ? "" : "s"} · {participation.totalVerifiedGames} verified games
          </span>
        ) : undefined
      }
    >
      {/* League table */}
      {leagues.length > 0 && (
        <div className="overflow-hidden border border-line-500">
          <div className="hidden grid-cols-[minmax(0,1fr)_5rem_4rem_4rem_4rem] gap-2 bg-court-900 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-white sm:grid">
            <span>League / Season</span>
            <span className="text-right">GP</span>
            <span className="text-right">PPG</span>
            <span className="text-right">RPG</span>
            <span className="text-right">APG</span>
          </div>
          {leagues.map((league) => (
            <div
              key={`${league.leagueName}-${league.seasonName}`}
              className="grid gap-2 border-b border-line-500 px-3 py-2 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_5rem_4rem_4rem_4rem] sm:items-center"
            >
              <div className="min-w-0">
                <strong className="block truncate text-sm font-bold text-court-900">{league.leagueName}</strong>
                <span className="block text-xs font-semibold text-court-500">{league.seasonName}</span>
              </div>
              <span className="text-right text-sm font-bold text-court-700">{league.gamesPlayed}</span>
              <span className="text-right text-sm font-bold text-court-700">{league.avgPoints.toFixed(1)}</span>
              <span className="text-right text-sm font-bold text-court-700">{league.avgRebounds.toFixed(1)}</span>
              <span className="text-right text-sm font-bold text-court-700">{league.avgAssists.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {/* PPG comparison bars (only if 2+ leagues) */}
      {multiLeague && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-court-500">Points per game by competition</p>
          <HorizontalBarChart
            ariaLabel="Average points per game by competition"
            rows={leagues.map((l) => ({
              label: `${l.leagueName} (${l.gamesPlayed} GP)`,
              value: l.avgPoints,
              detail: `${l.avgRebounds.toFixed(1)} RPG · ${l.avgAssists.toFixed(1)} APG`,
            }))}
          />
        </div>
      )}

    </ProfileModule>
  );
}

// ── Enhanced ranking trend ────────────────────────────────────────────────────

export function PlayerRankingTrend({ profile }: { profile: PlayerProfile }) {
  const rankData = profile.rankingTrend;

  if (rankData.length < 3) {
    return (
      <ProfileModule title="Board Standing" description={metricHelp("rankingTrend")}>
        <p className="text-sm font-semibold text-court-500">
          Ranking history will appear here once enough weekly board updates are on record.
          {rankData.length > 0
            ? ` ${rankData.length} week${rankData.length === 1 ? "" : "s"} charted so far — check back as the season continues.`
            : ""}
        </p>
      </ProfileModule>
    );
  }

  const maxRank = Math.max(...rankData.map((r) => r.rank));
  // Invert: rank 1 → top of chart. invertedValue = maxRank + 1 - rank
  const invertedRanks = rankData.map((r) => maxRank + 1 - r.rank);
  const labels = rankData.map((item) => formatDate(item.weekOf));

  const milestones: string[] = [];
  const bestEntry = rankData.reduce((best, r) => (r.rank < best.rank ? r : best), rankData[0]);
  milestones.push(`Career best: #${bestEntry.rank} (${formatDate(bestEntry.weekOf)})`);
  if (rankData[0].rank <= 50) milestones.push("Entered top 50");
  const current = rankData[rankData.length - 1];
  milestones.push(`Current: #${current.rank}`);

  return (
    <ProfileModule title="Board Standing" description={metricHelp("rankingTrend")}>
      <p className="mb-1 text-xs font-semibold text-court-500">
        National rank over time — higher on chart = better rank.
      </p>
      <LineTrendChart
        ariaLabel="Historical national rank over time"
        labels={labels}
        series={[{ key: "rank", label: "National rank", color: "#c2410c", values: invertedRanks, fillArea: true }]}
        yTickFormat={(v) => v === 0 ? "" : `#${maxRank + 1 - v}`}
        height={160}
      />
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {milestones.map((m) => (
          <span key={m} className="text-xs font-semibold text-court-500">{m}</span>
        ))}
      </div>
    </ProfileModule>
  );
}

// ── Full game log ─────────────────────────────────────────────────────────────

export function PlayerFullGameLog({ profile }: { profile: PlayerProfile }) {
  const competitions = useMemo(() => Array.from(new Set(profile.allGames.map((g) => g.leagueName))).sort(), [profile.allGames]);
  const [competition, setCompetition] = useState("ALL");
  const [result, setResult] = useState<GameLogResultFilter>("ALL");
  const [sort, setSort] = useState<GameLogSort>("date");
  const [direction, setDirection] = useState<SortDirection>("desc");

  const filteredGames = useMemo(() => {
    const next = profile.allGames
      .filter((g) => competition === "ALL" || g.leagueName === competition)
      .filter((g) => result === "ALL" || g.result === result);
    return next.sort((l, r) => {
      const mult = direction === "asc" ? 1 : -1;
      if (sort === "date") return (new Date(l.gameDate).getTime() - new Date(r.gameDate).getTime()) * mult;
      if (sort === "opponent") return l.opponentName.localeCompare(r.opponentName) * mult || new Date(r.gameDate).getTime() - new Date(l.gameDate).getTime();
      if (sort === "result") return l.result.localeCompare(r.result) * mult || new Date(r.gameDate).getTime() - new Date(l.gameDate).getTime();
      const stat = (g: PlayerProfileGame) => {
        if (sort === "minutes")     return g.minutes ?? 0;
        if (sort === "points")      return g.points;
        if (sort === "rebounds")    return g.rebounds;
        if (sort === "assists")     return g.assists;
        if (sort === "steals")      return g.steals ?? 0;
        if (sort === "blocks")      return g.blocks ?? 0;
        if (sort === "turnovers")   return g.turnovers ?? 0;
        if (sort === "fouls")       return g.fouls ?? 0;
        if (sort === "fieldGoals")  return ratio(g.fieldGoalsMade, g.fieldGoalsAttempt);
        if (sort === "twoPoints")   return ratio(g.twoMade, g.twoAttempt);
        if (sort === "threePoints") return ratio(g.threeMade, g.threeAttempt);
        if (sort === "freeThrows")  return ratio(g.freeThrowsMade, g.freeThrowsAttempt);
        return g.plusMinus ?? 0;
      };
      return (stat(l) - stat(r)) * mult || new Date(r.gameDate).getTime() - new Date(l.gameDate).getTime();
    });
  }, [competition, direction, profile.allGames, result, sort]);

  function updateSort(nextSort: GameLogSort) {
    setDirection((cur) => sort === nextSort ? (cur === "asc" ? "desc" : "asc") : descendingDefault(nextSort) ? "desc" : "asc");
    setSort(nextSort);
  }

  return (
    <ProfileModule id="game-log" title="Full Game Log" bodyClassName="p-0 md:p-0">
      {!profile.allGames.length ? <div className="p-4 md:p-5"><EmptyState icon="scores" title="No game logs available" /></div> : null}
      {profile.allGames.length > 0 && (
        <>
          <div className="grid gap-3 border-b border-line-500 bg-paper-500 p-3 md:grid-cols-3">
            <FilterSelect label="Competition" value={competition} onChange={setCompetition}>
              <option value="ALL">All competitions</option>
              {competitions.map((item) => <option key={item} value={item}>{item}</option>)}
            </FilterSelect>
            <FilterSelect label="Result" value={result} onChange={(v) => setResult(v as GameLogResultFilter)}>
              <option value="ALL">All results</option>
              <option value="W">Wins</option>
              <option value="L">Losses</option>
            </FilterSelect>
            <FilterSelect label="Sort" value={sort} onChange={(v) => { const s = v as GameLogSort; setSort(s); setDirection(descendingDefault(s) ? "desc" : "asc"); }}>
              <option value="date">Date</option>
              <option value="opponent">Opponent</option>
              <option value="result">Result</option>
              <option value="minutes">MIN</option>
              <option value="points">PTS</option>
              <option value="rebounds">REB</option>
              <option value="assists">AST</option>
              <option value="steals">STL</option>
              <option value="blocks">BLK</option>
              <option value="turnovers">TO</option>
              <option value="fouls">PF</option>
              <option value="fieldGoals">FG</option>
              <option value="twoPoints">2P</option>
              <option value="threePoints">3P</option>
              <option value="freeThrows">FT</option>
              <option value="plusMinus">+/-</option>
            </FilterSelect>
          </div>
          {filteredGames.length ? (
            <GameLogTable games={filteredGames} sort={sort} direction={direction} onSort={updateSort} />
          ) : (
            <div className="p-4 md:p-5"><EmptyState icon="scores" title="No games match these filters" /></div>
          )}
        </>
      )}
    </ProfileModule>
  );
}

// ── Legacy exports (kept for compare tool) ───────────────────────────────────

/** @deprecated Use PlayerSeasonProduction instead */
export function PlayerAnalytics({ profile }: { profile: PlayerProfile }) {
  const cards = [
    ["GP",  profile.averages.gamesPlayed],
    ["MPG", profile.averages.minutes ?? "—"],
    ["PPG", profile.averages.points],
    ["RPG", profile.averages.rebounds],
    ["APG", profile.averages.assists],
    ["SPG", profile.averages.steals],
    ["BPG", profile.averages.blocks],
    ["TOV", profile.averages.turnovers],
    ["PF",  profile.averages.fouls],
    ["+/-", profile.averages.plusMinus ?? "—"],
  ];
  return (
    <ProfileModule title="Player Analytics">
      <div className="grid gap-1.5 sm:grid-cols-5 lg:grid-cols-10">
        {cards.map(([label, value]) => (
          <StatCard key={label as string} label={label as string} value={statValue(value as string | number)} />
        ))}
      </div>
    </ProfileModule>
  );
}

/** @deprecated Merged into PlayerSeasonProduction */
export function PlayerBestGame({ profile }: { profile: PlayerProfile }) {
  return null;
}

/** @deprecated Merged into PlayerSeasonProduction */
export function PlayerProfileStrengths({ profile }: { profile: PlayerProfile }) {
  return null;
}

/** @deprecated Merged into PlayerSeasonProduction */
export function PlayerProductionProfile({ profile }: { profile: PlayerProfile }) {
  return null;
}

// ── Filter select ─────────────────────────────────────────────────────────────

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-court-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-9 border border-line-500 bg-white px-3 py-1.5 text-sm font-bold text-court-900 outline-none focus:border-hardwood-600"
      >
        {children}
      </select>
    </label>
  );
}

// ── Game log table ─────────────────────────────────────────────────────────────

function GameLogTable({ games, sort, direction, onSort }: { games: PlayerProfileGame[]; sort: GameLogSort; direction: SortDirection; onSort: (s: GameLogSort) => void }) {
  return (
    <div className="max-w-full overflow-x-auto bg-white">
      <div className="sports-table-head hidden min-w-[72rem] grid-cols-[6.5rem_minmax(11rem,1.2fr)_4.5rem_repeat(13,3.7rem)] gap-2 xl:grid">
        <GameLogSortHeader label="Date"     column="date"       sort={sort} direction={direction} onSort={onSort} align="left" />
        <GameLogSortHeader label="Opponent" column="opponent"   sort={sort} direction={direction} onSort={onSort} align="left" />
        <GameLogSortHeader label="Result"   column="result"     sort={sort} direction={direction} onSort={onSort} />
        <GameLogSortHeader label="MIN"  column="minutes"    sort={sort} direction={direction} onSort={onSort} />
        <GameLogSortHeader label="PTS"  column="points"     sort={sort} direction={direction} onSort={onSort} />
        <GameLogSortHeader label="REB"  column="rebounds"   sort={sort} direction={direction} onSort={onSort} />
        <GameLogSortHeader label="AST"  column="assists"    sort={sort} direction={direction} onSort={onSort} />
        <GameLogSortHeader label="STL"  column="steals"     sort={sort} direction={direction} onSort={onSort} />
        <GameLogSortHeader label="BLK"  column="blocks"     sort={sort} direction={direction} onSort={onSort} />
        <GameLogSortHeader label="TO"   column="turnovers"  sort={sort} direction={direction} onSort={onSort} />
        <GameLogSortHeader label="PF"   column="fouls"      sort={sort} direction={direction} onSort={onSort} />
        <GameLogSortHeader label="FG"   column="fieldGoals" sort={sort} direction={direction} onSort={onSort} />
        <GameLogSortHeader label="2P"   column="twoPoints"  sort={sort} direction={direction} onSort={onSort} />
        <GameLogSortHeader label="3P"   column="threePoints" sort={sort} direction={direction} onSort={onSort} />
        <GameLogSortHeader label="FT"   column="freeThrows" sort={sort} direction={direction} onSort={onSort} />
        <GameLogSortHeader label="+/-"  column="plusMinus"  sort={sort} direction={direction} onSort={onSort} />
      </div>
      <div className="max-h-[26.5rem] overflow-y-auto">
        {games.map((game) => (
          <Link
            key={game.gameId}
            href={`/games/${game.gameId}`}
            className="group grid min-w-[72rem] gap-2 border-b border-line-500 px-3 py-2 text-sm last:border-b-0 hover:bg-paper-500 xl:grid-cols-[6.5rem_minmax(11rem,1.2fr)_4.5rem_repeat(13,3.7rem)] xl:items-center"
          >
            <span className="sticky left-0 z-10 bg-white pr-2 font-semibold text-court-500 group-hover:bg-paper-500 xl:static xl:bg-transparent">{formatDate(game.gameDate)}</span>
            <span className="sticky left-[6.5rem] z-10 bg-white pr-2 xl:static xl:bg-transparent">
              <strong className="block text-court-900">vs {compactTeamName(game.opponentName)}</strong>
              <small className="block text-xs font-semibold text-court-500">{game.leagueName}</small>
            </span>
            <span><WinLossPill result={game.result} /></span>
            <InlineStat label="MIN" value={statValue(game.minutes)} />
            <InlineStat label="PTS" value={game.points} />
            <InlineStat label="REB" value={game.rebounds} />
            <InlineStat label="AST" value={game.assists} />
            <InlineStat label="STL" value={statValue(game.steals)} />
            <InlineStat label="BLK" value={statValue(game.blocks)} />
            <InlineStat label="TO"  value={statValue(game.turnovers)} />
            <InlineStat label="PF"  value={statValue(game.fouls)} />
            <InlineStat label="FG"  value={madeAttempt(game.fieldGoalsMade, game.fieldGoalsAttempt)} />
            <InlineStat label="2P"  value={madeAttempt(game.twoMade, game.twoAttempt)} />
            <InlineStat label="3P"  value={madeAttempt(game.threeMade, game.threeAttempt)} />
            <InlineStat label="FT"  value={madeAttempt(game.freeThrowsMade, game.freeThrowsAttempt)} />
            <InlineStat label="+/-" value={statValue(game.plusMinus)} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function GameLogSortHeader({ label, column, sort, direction, onSort, align = "center" }: {
  label: string; column: GameLogSort; sort: GameLogSort; direction: SortDirection; onSort: (s: GameLogSort) => void; align?: "left" | "center";
}) {
  const active = sort === column;
  return (
    <button type="button" onClick={() => onSort(column)} className={`${align === "left" ? "text-left" : "text-center"} font-bold hover:text-white`}>
      {label}{active ? <SortIndicator direction={direction} /> : null}
    </button>
  );
}

function InlineStat({ label, value }: { label: string; value: string | number }) {
  return (
    <span className="text-center">
      <strong className="block font-display text-base font-bold leading-none text-court-900 md:text-lg">{value}</strong>
      <small className="block text-[0.62rem] font-bold uppercase tracking-[0.12em] text-court-400 xl:hidden">{label}</small>
    </span>
  );
}
