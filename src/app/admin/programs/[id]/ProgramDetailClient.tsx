"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ProgramType } from "@prisma/client";
import { updatePlayerBio, type UpdatePlayerBioState } from "../../players/actions";
import { updatePlayerCurrentProgram, updateProgram, updateProgramTeam, type ProgramActionState } from "../actions";

const initialState: ProgramActionState = { ok: false, message: "" };
const initialPlayerState: UpdatePlayerBioState = { ok: false, message: "" };

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
};

export type ProgramSelectOption = {
  id: string;
  fullName: string;
  abbreviation: string | null;
};

export type ProgramPlayerData = {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  gender: string;
  currentProgramId: string | null;
  currentProgram: string;
  derivedProgram: string;
  schoolOverride: string | null;
  classYear: string;
  calculatedClassYear: number | null;
  classYearOverride: number | null;
  computedAgeBracket: string;
  ageGroupOverride: string | null;
  position: string | null;
  height: string;
  heightCm: number | null;
  city: string;
  region: string;
  birthDate: string;
  photoUrl: string | null;
  profileHref: string;
  appearsInMultipleTeamSections: boolean;
  recentTransfers: Array<{
    id: string;
    fromProgram: string;
    toProgram: string;
    effectiveDate: string | null;
    note: string | null;
    createdAt: string;
  }>;
};

export type ProgramTeamPlayerSectionData = {
  team: TeamEditorData;
  players: ProgramPlayerData[];
};

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="button primary w-fit disabled:opacity-60">{pending ? "Saving..." : label}</button>;
}

function StateMessage({ state }: { state: ProgramActionState | UpdatePlayerBioState }) {
  if (!state.message) return null;
  return <div className={`rounded-md p-3 text-sm ${state.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{state.message}</div>;
}

function formatList(values: string[]) {
  return values.length ? values.join(", ") : "Not available";
}

function cmToFeetInches(heightCm: number | null) {
  if (heightCm === null) return { feet: "", inches: "" };
  const totalInches = Math.round(heightCm / 2.54);
  return { feet: String(Math.floor(totalInches / 12)), inches: String(totalInches % 12) };
}

function feetInchesToCm(feet: string, inches: string) {
  const feetValue = Number(feet);
  const inchesValue = Number(inches);
  if (!Number.isInteger(feetValue) || !Number.isInteger(inchesValue)) return "";
  return String(Math.round((feetValue * 12 + inchesValue) * 2.54));
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

export function TeamMonikerForm({ programId, team }: { programId: string; team: TeamEditorData }) {
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
      </div>
      {team.contexts.length ? <p className="text-xs text-ink-500">{team.contexts.join(" | ")}</p> : null}
      <p className="rounded-md bg-surface-100 p-3 text-xs text-ink-600">Editing the moniker changes only this internal Team record. It does not merge teams or move official stats.</p>
      <StateMessage state={state} />
      <SaveButton label="Save team" />
    </form>
  );
}

export function TeamPlayerSection({ programId, section, programs }: { programId: string; section: ProgramTeamPlayerSectionData; programs: ProgramSelectOption[] }) {
  return (
    <article className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
      <div className="border-b border-surface-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl text-navy-800">{section.team.name}</h3>
            <p className="mt-1 text-sm text-ink-600">{formatList(section.team.ageGroups)} / {formatList(section.team.genders)} / {formatList(section.team.leagues)}</p>
            {section.team.contexts.length ? <p className="mt-1 text-xs text-ink-500">{section.team.contexts.join(" | ")}</p> : null}
          </div>
          <span className="rounded-full bg-navy-50 px-3 py-1 font-mono text-mono-sm uppercase text-navy-800">{section.players.length} players</span>
        </div>
      </div>
      <div className="grid gap-0">
        {section.players.map((player) => <ProgramPlayerRow key={`${section.team.id}:${player.id}`} programId={programId} player={player} programs={programs} />)}
        {!section.players.length ? <p className="p-5 text-sm text-ink-600">No active players found for this team.</p> : null}
      </div>
    </article>
  );
}

export function ProgramPlayerRow({ programId, player, programs }: { programId: string; player: ProgramPlayerData; programs: ProgramSelectOption[] }) {
  return (
    <div className="grid gap-3 border-b border-surface-200 p-4 last:border-b-0">
      <div className="grid gap-3 lg:grid-cols-[1.2fr_6rem_1fr_1fr_7rem_8rem] lg:items-start">
        <div>
          <strong className="block text-ink-900">{player.displayName}</strong>
          <a className="mt-1 inline-block text-sm font-semibold text-navy-700" href={player.profileHref}>Profile</a>
          {player.appearsInMultipleTeamSections ? <span className="mt-2 block rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">Also appears in another team section</span> : null}
        </div>
        <span className="font-mono text-sm text-ink-600">{player.gender}</span>
        <span className="text-sm text-ink-600"><strong className="block text-xs uppercase text-ink-400">Current</strong>{player.currentProgram}</span>
        <span className="text-sm text-ink-600"><strong className="block text-xs uppercase text-ink-400">Derived</strong>{player.derivedProgram}</span>
        <span className="text-sm text-ink-600">{player.classYear}</span>
        <span className="text-sm text-ink-600">{player.position ?? "Position missing"}<span className="block text-xs text-ink-400">{player.height}</span></span>
      </div>
      <details className="rounded-md border border-surface-200 bg-surface-50 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-navy-800">Edit player</summary>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <PlayerBioEditForm player={player} />
          <PlayerCurrentProgramForm programId={programId} player={player} programs={programs} />
        </div>
      </details>
    </div>
  );
}

function PlayerBioEditForm({ player }: { player: ProgramPlayerData }) {
  const [state, formAction] = useFormState(updatePlayerBio, initialPlayerState);
  const initialHeight = cmToFeetInches(player.heightCm);
  const [heightCm, setHeightCm] = useState(player.heightCm === null ? "" : String(player.heightCm));
  const [heightFeet, setHeightFeet] = useState(initialHeight.feet);
  const [heightInches, setHeightInches] = useState(initialHeight.inches);
  const [heightMessage, setHeightMessage] = useState("");
  const visualClassYear = player.classYearOverride ?? player.calculatedClassYear;

  function updateHeightFromCm(value: string) {
    setHeightCm(value);
    const parsed = Number(value);
    if (!value) {
      setHeightFeet("");
      setHeightInches("");
      setHeightMessage("");
      return;
    }
    if (!Number.isInteger(parsed) || parsed < 120 || parsed > 230) {
      setHeightMessage("Height must be 120-230 cm.");
      return;
    }
    const converted = cmToFeetInches(parsed);
    setHeightFeet(converted.feet);
    setHeightInches(converted.inches);
    setHeightMessage(`${converted.feet}'${converted.inches}\"`);
  }

  function updateHeightFromFeetInches(nextFeet: string, nextInches: string) {
    setHeightFeet(nextFeet);
    setHeightInches(nextInches);
    if (!nextFeet && !nextInches) {
      setHeightCm("");
      setHeightMessage("");
      return;
    }
    const feetValue = Number(nextFeet);
    const inchesValue = Number(nextInches);
    if (!Number.isInteger(feetValue) || feetValue < 4 || feetValue > 7 || !Number.isInteger(inchesValue) || inchesValue < 0 || inchesValue > 11) {
      setHeightMessage("Use feet 4-7 and inches 0-11.");
      return;
    }
    const cm = feetInchesToCm(nextFeet, nextInches);
    setHeightCm(cm);
    setHeightMessage(`${cm} cm`);
  }

  return (
    <form action={formAction} className="grid gap-3 rounded-md border border-surface-200 bg-white p-4">
      <input type="hidden" name="playerId" value={player.id} />
      <div>
        <p className="label">Profile Fields</p>
        <p className="mt-1 text-xs text-ink-500">Ratings, games, stats, and snapshots are read-only.</p>
      </div>
      <StateMessage state={state} />
      <div className="grid gap-3 md:grid-cols-2">
        <TextField name="displayName" label="Display name" defaultValue={player.displayName} required maxLength={120} />
        <ReadonlyField label="Gender" value={player.gender} />
        <TextField name="firstName" label="First name" defaultValue={player.firstName} required maxLength={80} />
        <TextField name="lastName" label="Last name" defaultValue={player.lastName} required maxLength={80} />
        <TextField name="city" label="City" defaultValue={player.city} required maxLength={100} />
        <TextField name="region" label="Region" defaultValue={player.region} required maxLength={100} />
        <TextField name="position" label="Position" defaultValue={player.position ?? ""} maxLength={20} placeholder="Optional" />
        <TextField name="schoolOverride" label="School override" defaultValue={player.schoolOverride ?? ""} maxLength={160} placeholder="Prefer Current Program when possible" />
        <ReadonlyField label="Calculated age bracket" value={player.computedAgeBracket} />
        <label className="grid gap-2 text-sm font-semibold text-ink-700">Age Bracket Override<select name="ageGroupOverride" defaultValue={player.ageGroupOverride ?? ""} className="min-h-10 rounded-md border border-surface-300 px-3 py-2"><option value="">Use calculated</option><option value="U13">U13</option><option value="U16">U16</option><option value="U19">U19</option></select></label>
        <label className="grid gap-2 text-sm font-semibold text-ink-700">Birth date<input name="birthDate" type="date" defaultValue={player.birthDate} className="min-h-10 rounded-md border border-surface-300 px-3 py-2" /></label>
        <label className="grid gap-2 text-sm font-semibold text-ink-700">Class Year<input name="classYear" type="number" min={2000} max={2100} defaultValue={visualClassYear ?? ""} className="min-h-10 rounded-md border border-surface-300 px-3 py-2" placeholder="Optional" /></label>
        <div className="grid gap-2 rounded-md border border-surface-200 p-3 md:col-span-2">
          <span className="text-sm font-semibold text-ink-700">Height</span>
          <div className="grid gap-2 md:grid-cols-3">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">Centimeters<input name="heightCm" type="number" min={120} max={230} value={heightCm} onChange={(event) => updateHeightFromCm(event.target.value)} className="min-h-10 rounded-md border border-surface-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink-900" placeholder="Optional" /></label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">Feet<input type="number" min={4} max={7} value={heightFeet} onChange={(event) => updateHeightFromFeetInches(event.target.value, heightInches)} className="min-h-10 rounded-md border border-surface-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink-900" placeholder="ft" /></label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">Inches<input type="number" min={0} max={11} value={heightInches} onChange={(event) => updateHeightFromFeetInches(heightFeet, event.target.value)} className="min-h-10 rounded-md border border-surface-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink-900" placeholder="in" /></label>
          </div>
          {heightMessage ? <span className="text-xs font-normal text-ink-500">{heightMessage}</span> : null}
        </div>
        <TextField name="photoUrl" label="Photo URL" defaultValue={player.photoUrl ?? ""} maxLength={500} placeholder="https://..." />
      </div>
      <SaveButton label="Save player" />
    </form>
  );
}

export function PlayerCurrentProgramForm({ programId, player, programs }: { programId: string; player: ProgramPlayerData; programs: ProgramSelectOption[] }) {
  const [state, formAction] = useFormState(updatePlayerCurrentProgram, initialState);
  const [mode, setMode] = useState<"EDIT" | "TRANSFER">("EDIT");

  return (
    <form action={formAction} className="grid gap-3 rounded-md border border-surface-200 bg-white p-4">
      <input type="hidden" name="programId" value={programId} />
      <input type="hidden" name="playerId" value={player.id} />
      <div>
        <p className="label">Current Program</p>
        <p className="mt-1 text-xs text-ink-500">Changing current program does not modify historical GameStats or teams.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">Target Program<select name="nextProgramId" defaultValue={player.currentProgramId ?? programId} className="min-h-10 rounded-md border border-surface-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink-900">{programs.map((option) => <option key={option.id} value={option.id}>{option.fullName}{option.abbreviation ? ` (${option.abbreviation})` : ""}</option>)}</select></label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">Mode<select name="changeMode" value={mode} onChange={(event) => setMode(event.target.value as "EDIT" | "TRANSFER")} className="min-h-10 rounded-md border border-surface-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink-900"><option value="EDIT">Edit only</option><option value="TRANSFER">Transfer</option></select></label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">Effective Date<input name="effectiveDate" type="date" required={mode === "TRANSFER"} disabled={mode !== "TRANSFER"} className="min-h-10 rounded-md border border-surface-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink-900 disabled:bg-surface-100" /></label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink-500">Note<input name="note" maxLength={500} placeholder="Optional" className="min-h-10 rounded-md border border-surface-300 bg-white px-3 text-sm font-normal normal-case tracking-normal text-ink-900" /></label>
      </div>
      {player.recentTransfers.length ? <div className="rounded-md border border-surface-200 p-3 text-xs text-ink-600"><strong className="block text-ink-800">Recent transfer history</strong>{player.recentTransfers.map((history) => <div key={history.id}>{history.effectiveDate ?? history.createdAt}: {history.fromProgram} to {history.toProgram}{history.note ? ` - ${history.note}` : ""}</div>)}</div> : null}
      <StateMessage state={state} />
      <SaveButton label={mode === "TRANSFER" ? "Record transfer" : "Save current program"} />
    </form>
  );
}

function TextField({ name, label, defaultValue, required = false, maxLength, placeholder }: { name: string; label: string; defaultValue: string; required?: boolean; maxLength: number; placeholder?: string }) {
  return <label className="grid gap-2 text-sm font-semibold text-ink-700">{label}<input name={name} defaultValue={defaultValue} required={required} maxLength={maxLength} placeholder={placeholder} className="min-h-10 rounded-md border border-surface-300 px-3 py-2" /></label>;
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return <label className="grid gap-2 text-sm font-semibold text-ink-700">{label}<input value={value} readOnly className="min-h-10 rounded-md border border-surface-200 bg-surface-100 px-3 py-2 text-ink-500" /></label>;
}
