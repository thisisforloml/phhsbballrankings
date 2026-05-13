"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, X } from "lucide-react";
import { leagues, players, formatPlayerName } from "@/lib/mock-data";

type Setup = {
  league: string;
  season: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  phase: string;
  venue: string;
};

type StatRow = {
  id: number;
  playerName: string;
  team: string;
  min: string;
  pts: string;
  fgm: string;
  fga: string;
  threePm: string;
  threePa: string;
  ftm: string;
  fta: string;
  oreb: string;
  dreb: string;
  trb: string;
  ast: string;
  stl: string;
  blk: string;
  tov: string;
  pf: string;
  linkedPlayerId?: string;
  isStub?: boolean;
};

const phases = ["Regular Season", "Quarterfinal", "Semifinal", "Final", "Other"];
const columns: Array<{ key: keyof StatRow; label: string }> = [
  { key: "playerName", label: "Player Name" },
  { key: "team", label: "Team" },
  { key: "min", label: "MIN" },
  { key: "pts", label: "PTS" },
  { key: "fgm", label: "FGM" },
  { key: "fga", label: "FGA" },
  { key: "threePm", label: "3PM" },
  { key: "threePa", label: "3PA" },
  { key: "ftm", label: "FTM" },
  { key: "fta", label: "FTA" },
  { key: "oreb", label: "OREB" },
  { key: "dreb", label: "DREB" },
  { key: "trb", label: "TRB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tov", label: "TOV" },
  { key: "pf", label: "PF" }
];

function emptyRow(id: number, team: string): StatRow {
  return {
    id,
    playerName: "",
    team,
    min: "",
    pts: "",
    fgm: "",
    fga: "",
    threePm: "",
    threePa: "",
    ftm: "",
    fta: "",
    oreb: "",
    dreb: "",
    trb: "",
    ast: "",
    stl: "",
    blk: "",
    tov: "",
    pf: ""
  };
}

function n(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pct(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function computed(row: StatRow, teamMinutes: number, teamFga: number, teamFta: number, teamTov: number) {
  const fga = n(row.fga);
  const fgm = n(row.fgm);
  const threePm = n(row.threePm);
  const fta = n(row.fta);
  const pts = n(row.pts);
  const min = n(row.min);
  const tov = n(row.tov);
  const efg = fga > 0 ? ((fgm + 0.5 * threePm) / fga) * 100 : null;
  const tsDenominator = 2 * (fga + 0.44 * fta);
  const ts = tsDenominator > 0 ? (pts / tsDenominator) * 100 : null;
  const usageDenominator = min * (teamFga + 0.44 * teamFta + teamTov);
  const usg = min > 0 && usageDenominator > 0 ? 100 * (((fga + 0.44 * fta + tov) * (teamMinutes / 5)) / usageDenominator) : null;
  return { efg, ts, usg };
}

export function LiveStatsClient() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [activeTeam, setActiveTeam] = useState<"home" | "away">("home");
  const [submitted, setSubmitted] = useState(false);
  const [setup, setSetup] = useState<Setup>({
    league: "",
    season: "",
    date: new Date().toISOString().slice(0, 10),
    homeTeam: "",
    awayTeam: "",
    phase: "Regular Season",
    venue: ""
  });
  const [homeRows, setHomeRows] = useState<StatRow[]>([emptyRow(1, "Home"), emptyRow(2, "Home"), emptyRow(3, "Home")]);
  const [awayRows, setAwayRows] = useState<StatRow[]>([emptyRow(1, "Away"), emptyRow(2, "Away"), emptyRow(3, "Away")]);

  const allRows = [...homeRows, ...awayRows];
  const playerOfGame = useMemo(() => {
    return allRows
      .filter((row) => row.playerName.trim())
      .map((row) => ({
        row,
        score: n(row.pts) + n(row.trb) * 1.2 + n(row.ast) * 1.5 + n(row.stl) * 1.5 + n(row.blk) * 1.2 - n(row.tov)
      }))
      .sort((a, b) => b.score - a.score)[0];
  }, [allRows]);

  if (submitted) {
    return (
      <main className="min-h-screen bg-surface-50 pt-28">
        <section className="container-px max-w-3xl py-10">
          <article className="rounded-lg border border-surface-200 bg-white p-8 text-center shadow-panel">
            <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-500">Submitted Successfully</p>
            <h1 className="mt-3 font-display text-stat-md text-navy-800">Submitted Successfully</h1>
            <p className="mx-auto mt-3 max-w-xl text-surface-600">
              This game has been submitted for OnCourt review. Stats will be verified and reflected in national rankings on the next Monday update at 12:00 PM.
            </p>
            <p className="mt-5 font-semibold text-navy-800">Player of the Game: {playerOfGame?.row.playerName || "—"}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button onClick={() => { setSubmitted(false); setStep(1); }} className="button primary">Submit Another Game</button>
              <Link href="/portal" className="button secondary">Back to Dashboard</Link>
            </div>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface-50 pt-28">
      <section className="container-px grid gap-6 pb-16">
        <div className="rounded-lg bg-navy-800 p-6 text-white shadow-panel">
          <p className="inline-flex items-center gap-2 font-mono text-label uppercase tracking-[0.12em] text-amber-400">
            <Activity className="h-4 w-4" aria-hidden="true" />
            Live Stats Entry
          </p>
          <h1 className="mt-3 font-display text-stat-md">Game Statistics Software</h1>
          <p className="mt-3 max-w-2xl text-navy-200">Fast, keyboard-friendly stat entry for partnered organizers.</p>
        </div>

        <div className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap gap-2 font-mono text-mono-sm uppercase">
            {["Game Setup", "Stat Entry", "Review", "Submit"].map((label, index) => (
              <span key={label} className={`rounded-full px-3 py-1 ${step === index + 1 ? "bg-amber-500 text-white" : "bg-surface-100 text-surface-500"}`}>{label}</span>
            ))}
          </div>
        </div>

        {step === 1 ? <SetupStep setup={setup} setSetup={setSetup} onNext={() => setStep(2)} /> : null}
        {step === 2 ? (
          <EntryStep
            activeTeam={activeTeam}
            setActiveTeam={setActiveTeam}
            homeRows={homeRows}
            awayRows={awayRows}
            setHomeRows={setHomeRows}
            setAwayRows={setAwayRows}
            onNext={() => setStep(3)}
          />
        ) : null}
        {step === 3 ? <ReviewStep setup={setup} homeRows={homeRows} awayRows={awayRows} playerOfGame={playerOfGame} onSubmit={() => { setStep(4); setSubmitted(true); }} /> : null}
      </section>
    </main>
  );
}

function SetupStep({ setup, setSetup, onNext }: { setup: Setup; setSetup: (setup: Setup) => void; onNext: () => void }) {
  return (
    <section className="rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
      <h2 className="font-display text-3xl text-navy-800">Step 1 · Game Setup</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold text-surface-700">Select League<select value={setup.league} onChange={(event) => setSetup({ ...setup, league: event.target.value })} className="min-h-11 rounded-md border border-surface-200 px-3 py-2"><option>No assigned leagues</option>{leagues.map((league) => <option key={league.id}>{league.name}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-semibold text-surface-700">Select Season<select value={setup.season} onChange={(event) => setSetup({ ...setup, season: event.target.value })} className="min-h-11 rounded-md border border-surface-200 px-3 py-2"><option>Active season unavailable</option></select></label>
        <label className="grid gap-2 text-sm font-semibold text-surface-700">Game Date<input value={setup.date} onChange={(event) => setSetup({ ...setup, date: event.target.value })} type="date" className="min-h-11 rounded-md border border-surface-200 px-3 py-2" /></label>
        <label className="grid gap-2 text-sm font-semibold text-surface-700">Home Team<select value={setup.homeTeam} onChange={(event) => setSetup({ ...setup, homeTeam: event.target.value })} className="min-h-11 rounded-md border border-surface-200 px-3 py-2"><option>No teams available</option></select></label>
        <label className="grid gap-2 text-sm font-semibold text-surface-700">Away Team<select value={setup.awayTeam} onChange={(event) => setSetup({ ...setup, awayTeam: event.target.value })} className="min-h-11 rounded-md border border-surface-200 px-3 py-2"><option>No teams available</option></select></label>
        <label className="grid gap-2 text-sm font-semibold text-surface-700">Venue<input value={setup.venue} onChange={(event) => setSetup({ ...setup, venue: event.target.value })} className="min-h-11 rounded-md border border-surface-200 px-3 py-2" placeholder="Optional" /></label>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {phases.map((phase) => (
          <button key={phase} onClick={() => setSetup({ ...setup, phase })} className={`rounded-full px-4 py-2 font-mono text-mono-sm uppercase ${setup.phase === phase ? "bg-navy-800 text-white" : "bg-surface-100 text-surface-600"}`} type="button">
            {phase}
          </button>
        ))}
      </div>
      <button onClick={onNext} className="button primary mt-6">Begin Stat Entry →</button>
    </section>
  );
}

function EntryStep(props: {
  activeTeam: "home" | "away";
  setActiveTeam: (team: "home" | "away") => void;
  homeRows: StatRow[];
  awayRows: StatRow[];
  setHomeRows: (rows: StatRow[]) => void;
  setAwayRows: (rows: StatRow[]) => void;
  onNext: () => void;
}) {
  const rows = props.activeTeam === "home" ? props.homeRows : props.awayRows;
  const setRows = props.activeTeam === "home" ? props.setHomeRows : props.setAwayRows;
  return (
    <section className="rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-3xl text-navy-800">Step 2 · Player Stat Entry</h2>
        <div className="inline-flex rounded-full bg-surface-100 p-1">
          {(["home", "away"] as const).map((team) => (
            <button key={team} onClick={() => props.setActiveTeam(team)} className={`rounded-full px-5 py-2 font-semibold capitalize ${props.activeTeam === team ? "bg-navy-800 text-white" : "text-surface-600"}`}>
              {team === "home" ? "Home Team" : "Away Team"}
            </button>
          ))}
        </div>
      </div>
      <StatTable rows={rows} setRows={setRows} />
      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={() => setRows([...rows, emptyRow(Date.now(), props.activeTeam === "home" ? "Home" : "Away")])} className="button secondary" type="button">+ Add Player</button>
        <button onClick={props.onNext} className="button primary" type="button">Review and Submit</button>
      </div>
    </section>
  );
}

function StatTable({ rows, setRows }: { rows: StatRow[]; setRows: (rows: StatRow[]) => void }) {
  const teamMinutes = rows.reduce((sum, row) => sum + n(row.min), 0);
  const teamFga = rows.reduce((sum, row) => sum + n(row.fga), 0);
  const teamFta = rows.reduce((sum, row) => sum + n(row.fta), 0);
  const teamTov = rows.reduce((sum, row) => sum + n(row.tov), 0);

  function updateRow(id: number, key: keyof StatRow, value: string) {
    setRows(rows.map((row) => {
      if (row.id !== id) return row;
      const next = { ...row, [key]: value };
      if (key === "oreb" || key === "dreb") {
        next.trb = String(n(next.oreb) + n(next.dreb));
      }
      return next;
    }));
  }

  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-surface-200">
      <div className="min-w-[96rem]">
        <div className="grid grid-cols-[15rem_7rem_repeat(16,4.25rem)_5rem_5rem_5rem_2.5rem] gap-2 bg-surface-100 p-3 font-mono text-mono-sm uppercase text-surface-600">
          {columns.map((column) => <span key={column.key}>{column.label}</span>)}
          <span>eFG%</span><span>TS%</span><span>USG%</span><span />
        </div>
        {rows.map((row) => {
          const metrics = computed(row, teamMinutes, teamFga, teamFta, teamTov);
          const suggestions = row.playerName.trim()
            ? players.filter((player) => formatPlayerName(player).toLowerCase().includes(row.playerName.toLowerCase())).slice(0, 3)
            : [];
          return (
            <div key={row.id} className="group relative grid grid-cols-[15rem_7rem_repeat(16,4.25rem)_5rem_5rem_5rem_2.5rem] gap-2 border-t border-surface-200 p-3">
              {columns.map((column) => (
                <span key={column.key} className="relative">
                  <input
                    value={String(row[column.key] ?? "")}
                    onChange={(event) => updateRow(row.id, column.key, event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.key === "Enter" || event.key === "Tab") && column.key === "playerName" && row.playerName.trim() && !suggestions.length) {
                        row.isStub = true;
                      }
                    }}
                    className="min-h-10 w-full rounded border border-surface-200 px-2 text-sm"
                    placeholder={column.key === "playerName" ? "Type full name" : ""}
                  />
                  {column.key === "playerName" && suggestions.length ? (
                    <span className="absolute left-0 top-full z-10 mt-1 grid w-72 rounded-md border border-surface-200 bg-white p-2 shadow-panel">
                      {suggestions.map((player) => (
                        <button key={player.id} type="button" onClick={() => updateRow(row.id, "playerName", formatPlayerName(player))} className="rounded px-2 py-1 text-left text-sm hover:bg-amber-50">
                          {formatPlayerName(player)} · {player.position ?? "Position pending"} · {player.city}
                        </button>
                      ))}
                    </span>
                  ) : null}
                  {column.key === "playerName" && row.isStub ? <small className="mt-1 block text-amber-600">New player — will be verified</small> : null}
                </span>
              ))}
              <span className="py-2 font-mono text-mono-sm text-surface-400">{pct(metrics.efg)}</span>
              <span className="py-2 font-mono text-mono-sm text-surface-400">{pct(metrics.ts)}</span>
              <span className="py-2 font-mono text-mono-sm text-surface-400">{pct(metrics.usg)}</span>
              <button onClick={() => setRows(rows.filter((item) => item.id !== row.id))} className="opacity-0 transition group-hover:opacity-100" type="button" aria-label="Remove row"><X className="h-4 w-4" /></button>
            </div>
          );
        })}
        <div className="grid grid-cols-[15rem_7rem_repeat(16,4.25rem)_5rem_5rem_5rem_2.5rem] gap-2 bg-navy-800 p-3 font-display text-lg text-white">
          <span>Totals</span><span />
          {columns.slice(2).map((column) => <span key={column.key}>{rows.reduce((sum, row) => sum + n(String(row[column.key] ?? "")), 0)}</span>)}
          <span /><span /><span /><span />
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ setup, homeRows, awayRows, playerOfGame, onSubmit }: { setup: Setup; homeRows: StatRow[]; awayRows: StatRow[]; playerOfGame?: { row: StatRow; score: number }; onSubmit: () => void }) {
  const homeScore = homeRows.reduce((sum, row) => sum + n(row.pts), 0);
  const awayScore = awayRows.reduce((sum, row) => sum + n(row.pts), 0);
  return (
    <section className="grid gap-5 rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
      <h2 className="font-display text-3xl text-navy-800">Step 3 · Review and Submit</h2>
      <div className="grid gap-3 rounded-lg bg-surface-100 p-4 md:grid-cols-3">
        <span><strong className="block text-navy-800">League</strong>{setup.league || "No league selected"}</span>
        <span><strong className="block text-navy-800">Date</strong>{setup.date}</span>
        <span><strong className="block text-navy-800">Phase</strong>{setup.phase}</span>
        <span><strong className="block text-navy-800">Venue</strong>{setup.venue || "—"}</span>
        <span><strong className="block text-navy-800">Home Score</strong>{homeScore}</span>
        <span><strong className="block text-navy-800">Away Score</strong>{awayScore}</span>
      </div>
      <article className="rounded-lg border border-amber-200 bg-amber-50 p-5">
        <p className="font-mono text-label uppercase tracking-[0.12em] text-amber-700">Player of the Game</p>
        <h3 className="mt-2 font-display text-3xl text-navy-800">{playerOfGame?.row.playerName || "—"}</h3>
        <p className="text-surface-600">
          {playerOfGame ? `${playerOfGame.row.team} · ${n(playerOfGame.row.pts)} pts · ${n(playerOfGame.row.trb)} reb · ${n(playerOfGame.row.ast)} ast · Performance Score: ${playerOfGame.score.toFixed(1)}` : "Enter player stats to generate the award preview."}
        </p>
      </article>
      <article className="rounded-lg border border-surface-200 p-5">
        <p className="font-mono text-label uppercase tracking-[0.12em] text-surface-500">Current Tournament Leaders</p>
        <div className="mt-3 grid gap-2 font-mono text-mono-sm text-surface-600 md:grid-cols-3">
          <span>Scoring: No verified data yet</span>
          <span>Assists: No verified data yet</span>
          <span>Rebounds: No verified data yet</span>
        </div>
      </article>
      <button onClick={onSubmit} className="button primary w-full">Submit for OnCourt Review</button>
    </section>
  );
}
