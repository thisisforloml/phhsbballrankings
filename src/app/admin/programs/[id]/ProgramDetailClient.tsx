"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ProgramType } from "@prisma/client";
import { updatePlayerCurrentProgram, updateProgram, updateProgramTeam, type ProgramActionState } from "../actions";

const initialState: ProgramActionState = { ok: false, message: "" };

export type ProgramEditorData = {
  id: string;
  fullName: string;
  abbreviation: string | null;
  type: ProgramType;
  city: string | null;
  region: string | null;
  aliasesText: string;
};

export type TeamEditorData = {
  id: string;
  name: string;
  ageGroups: string[];
  genders: string[];
  leagues: string[];
  contexts: string[];
  officialGames: number;
  activeGameStats: number;
  latestGameDate: string | null;
  historicalHomeGames: number;
  historicalAwayGames: number;
  historicalGameStats: number;
};

export type ProgramSelectOption = {
  id: string;
  fullName: string;
  abbreviation: string | null;
};

export type ProgramPlayerData = {
  id: string;
  displayName: string;
  gender: string;
  currentProgramId: string | null;
  currentProgram: string;
  derivedProgram: string;
  classYear: string;
  position: string;
  height: string;
  profileHref: string;
  recentTransfers: Array<{
    id: string;
    fromProgram: string;
    toProgram: string;
    effectiveDate: string | null;
    note: string | null;
    createdAt: string;
  }>;
};

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="button primary w-fit disabled:opacity-60">{pending ? "Saving..." : label}</button>;
}

function StateMessage({ state }: { state: ProgramActionState }) {
  if (!state.message) return null;
  return <div className={`rounded-md p-3 text-sm ${state.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{state.message}</div>;
}

function formatList(values: string[]) {
  return values.length ? values.join(", ") : "Not available";
}

export function ProgramEditor({ program }: { program: ProgramEditorData }) {
  const [state, formAction] = useFormState(updateProgram, initialState);
  return (
    <form action={formAction} className="grid gap-4 rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="programId" value={program.id} />
      <div>
        <p className="label">Program Details</p>
        <h2 className="mt-2 font-display text-3xl text-navy-800">Edit Program</h2>
      </div>
      <StateMessage state={state} />
      <label className="grid gap-2 text-sm font-semibold text-ink-700">Full Name<input name="fullName" required maxLength={180} defaultValue={program.fullName} className="rounded-md border border-surface-300 px-3 py-3" /></label>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold text-ink-700">Abbreviation<input name="abbreviation" maxLength={80} defaultValue={program.abbreviation ?? ""} className="rounded-md border border-surface-300 px-3 py-3" /></label>
        <label className="grid gap-2 text-sm font-semibold text-ink-700">Type<select name="type" defaultValue={program.type} className="rounded-md border border-surface-300 px-3 py-3"><option>SCHOOL</option><option>CLUB</option><option>TEAM</option><option>UNKNOWN</option></select></label>
        <label className="grid gap-2 text-sm font-semibold text-ink-700">City<input name="city" maxLength={100} defaultValue={program.city ?? ""} placeholder="Optional" className="rounded-md border border-surface-300 px-3 py-3" /></label>
      </div>
      <label className="grid gap-2 text-sm font-semibold text-ink-700">Region<input name="region" maxLength={100} defaultValue={program.region ?? ""} placeholder="Optional" className="rounded-md border border-surface-300 px-3 py-3" /></label>
      <label className="grid gap-2 text-sm font-semibold text-ink-700">Aliases<textarea name="aliases" defaultValue={program.aliasesText} rows={5} className="rounded-md border border-surface-300 px-3 py-3" /><span className="text-xs font-normal text-ink-500">Use one alias per line or comma-separated aliases.</span></label>
      <SaveButton label="Save program" />
    </form>
  );
}

export function TeamMonikerForm({ programId, team, legacy = false }: { programId: string; team: TeamEditorData; legacy?: boolean }) {
  const [state, formAction] = useFormState(updateProgramTeam, initialState);
  return (
    <form action={formAction} className="grid gap-3 rounded-md border border-surface-200 p-4">
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="teamId" value={team.id} />
      <label className="grid gap-2 text-sm font-semibold text-ink-700">Team / Moniker Name<input name="name" required maxLength={120} defaultValue={team.name} className="rounded-md border border-surface-300 px-3 py-3" /></label>
      <div className="grid gap-2 text-xs text-ink-500 sm:grid-cols-2">
        <span>Age group: {formatList(team.ageGroups)}</span>
        <span>Gender: {formatList(team.genders)}</span>
        <span className="sm:col-span-2">League(s): {formatList(team.leagues)}</span>
        <span>Official games: {team.officialGames}</span>
        <span>GameStats: {team.activeGameStats}</span>
        <span>Latest game: {team.latestGameDate ?? "No active games"}</span>
        {legacy ? <span className="sm:col-span-2">Historical linked rows: home games {team.historicalHomeGames}, away games {team.historicalAwayGames}, stat rows {team.historicalGameStats}</span> : null}
      </div>
      {team.contexts.length ? <p className="text-xs text-ink-500">{team.contexts.join(" | ")}</p> : null}
      <p className="rounded-md bg-surface-100 p-3 text-xs text-ink-600">Editing the moniker changes only this Team record. It does not merge teams or move official stats.</p>
      <StateMessage state={state} />
      <SaveButton label="Save team" />
    </form>
  );
}

export function PlayerCurrentProgramForm({ programId, player, programs }: { programId: string; player: ProgramPlayerData; programs: ProgramSelectOption[] }) {
  const [state, formAction] = useFormState(updatePlayerCurrentProgram, initialState);
  const [mode, setMode] = useState<"EDIT" | "TRANSFER">("EDIT");

  return (
    <form action={formAction} className="grid gap-3 border-b border-surface-200 px-4 py-4 last:border-b-0">
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="playerId" value={player.id} />
      <div className="grid gap-3 lg:grid-cols-[1.25fr_7rem_1fr_1fr_8rem_8rem] lg:items-start">
        <div>
          <strong className="block text-ink-900">{player.displayName}</strong>
          <a className="mt-1 inline-block text-sm font-semibold text-navy-700" href={player.profileHref}>Profile</a>
        </div>
        <span className="font-mono text-sm text-ink-600">{player.gender}</span>
        <span className="text-sm text-ink-600"><strong className="block text-xs uppercase text-ink-400">Current</strong>{player.currentProgram}</span>
        <span className="text-sm text-ink-600"><strong className="block text-xs uppercase text-ink-400">Derived</strong>{player.derivedProgram}</span>
        <span className="text-sm text-ink-600">{player.classYear}</span>
        <span className="text-sm text-ink-600">{player.position}<span className="block text-xs text-ink-400">{player.height}</span></span>
      </div>
      <div className="grid gap-3 rounded-md bg-surface-50 p-3 md:grid-cols-[minmax(14rem,1fr)_10rem_10rem_minmax(12rem,1fr)]">
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">Target Program<select name="nextProgramId" defaultValue={player.currentProgramId ?? programId} className="min-h-10 rounded-md border border-surface-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink-900">{programs.map((option) => <option key={option.id} value={option.id}>{option.fullName}{option.abbreviation ? ` (${option.abbreviation})` : ""}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">Mode<select name="changeMode" value={mode} onChange={(event) => setMode(event.target.value as "EDIT" | "TRANSFER")} className="min-h-10 rounded-md border border-surface-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink-900"><option value="EDIT">Edit only</option><option value="TRANSFER">Transfer</option></select></label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">Effective Date<input name="effectiveDate" type="date" required={mode === "TRANSFER"} disabled={mode !== "TRANSFER"} className="min-h-10 rounded-md border border-surface-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink-900 disabled:bg-surface-100" /></label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">Note<input name="note" maxLength={500} placeholder="Optional" className="min-h-10 rounded-md border border-surface-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink-900" /></label>
      </div>
      {player.recentTransfers.length ? <div className="rounded-md border border-surface-200 p-3 text-xs text-ink-600"><strong className="block text-ink-800">Recent transfer history</strong>{player.recentTransfers.map((history) => <div key={history.id}>{history.effectiveDate ?? history.createdAt}: {history.fromProgram} to {history.toProgram}{history.note ? ` - ${history.note}` : ""}</div>)}</div> : null}
      <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">Changing current program does not modify historical GameStats or teams.</p>
      <StateMessage state={state} />
      <SaveButton label={mode === "TRANSFER" ? "Record transfer" : "Save current program"} />
    </form>
  );
}
