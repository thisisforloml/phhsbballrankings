"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { ProgramType } from "@prisma/client";
import { updateProgram, updateProgramTeam, type ProgramActionState } from "../actions";

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
  context: string;
  officialGames: number;
  gameStats: number;
};

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="button primary w-fit disabled:opacity-60">{pending ? "Saving..." : label}</button>;
}

function StateMessage({ state }: { state: ProgramActionState }) {
  if (!state.message) return null;
  return <div className={`rounded-md p-3 text-sm ${state.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{state.message}</div>;
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
      <div className="flex flex-wrap gap-2 text-xs text-ink-500"><span>{team.context}</span><span>Official games: {team.officialGames}</span><span>Stat rows: {team.gameStats}</span></div>
      <StateMessage state={state} />
      <SaveButton label="Save team" />
    </form>
  );
}