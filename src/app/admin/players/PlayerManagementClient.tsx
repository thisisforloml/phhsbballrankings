"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Search, UserRound } from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { updatePlayerBio, type UpdatePlayerBioState } from "./actions";

const initialFormState: UpdatePlayerBioState = { ok: false, message: "" };
const ageBracketOptions = ["All", "U13", "U16", "U19", "Unknown"];

type AgeBracketDisplay = "U13" | "U16" | "U19" | "OUT_OF_RANGE" | "Unknown" | null;

export type ManagedPlayer = {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  gender: "BOYS" | "GIRLS";
  school: string;
  schoolOverride: string | null;
  computedAgeBracket: AgeBracketDisplay;
  ageGroupOverride: string | null;
  displayAgeBracket: string;
  city: string;
  region: string;
  position: string | null;
  heightCm: number | null;
  birthDate: string;
  calculatedClassYear: number | null;
  classYearOverride: number | null;
  photoUrl: string | null;
  rating: number | null;
  verifiedGameCount: number | null;
};

function playerSearchText(player: ManagedPlayer) {
  return [player.displayName, player.firstName, player.lastName, player.school, player.city, player.region, player.gender, player.displayAgeBracket]
    .join(" ")
    .toLowerCase();
}

function displayHeight(heightCm: number | null) {
  return heightCm === null ? "-" : `${heightCm} cm`;
}

function displayRating(rating: number | null) {
  return rating === null ? "-" : rating.toFixed(2);
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

export function PlayerManagementClient({ players }: { players: ManagedPlayer[] }) {
  const [query, setQuery] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id ?? "");
  const [schoolFilter, setSchoolFilter] = useState("All");
  const [genderFilter, setGenderFilter] = useState("All");
  const [ageBracketFilter, setAgeBracketFilter] = useState("All");
  const [state, formAction] = useFormState(updatePlayerBio, initialFormState);

  useEffect(() => {
    if (state.ok) window.location.reload();
  }, [state.ok]);

  const schoolOptions = useMemo(() => Array.from(new Set(players.map((player) => player.school || "Unknown"))).sort(), [players]);

  const filteredPlayers = useMemo(() => {
    const value = query.trim().toLowerCase();
    return players
      .filter((player) => !value || playerSearchText(player).includes(value))
      .filter((player) => schoolFilter === "All" || (player.school || "Unknown") === schoolFilter)
      .filter((player) => genderFilter === "All" || player.gender === genderFilter)
      .filter((player) => ageBracketFilter === "All" || player.displayAgeBracket === ageBracketFilter || (!player.displayAgeBracket && ageBracketFilter === "Unknown"));
  }, [ageBracketFilter, genderFilter, players, query, schoolFilter]);

  const selectedPlayer = players.find((player) => player.id === selectedPlayerId) ?? filteredPlayers[0] ?? null;

  useEffect(() => {
    if (!selectedPlayer && filteredPlayers[0]) setSelectedPlayerId(filteredPlayers[0].id);
  }, [filteredPlayers, selectedPlayer]);

  return (
    <main className="min-h-screen bg-surface-50 pt-20">
      <div className="grid lg:grid-cols-[17rem_1fr]">
        <AdminSidebar active="players" />
        <section className="container-px grid gap-6 py-8">
          <div className="rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
            <p className="label">Player Search</p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-display text-stat-md text-navy-800">Player Search</h1>
                <p className="mt-2 max-w-3xl text-ink-600">Player editing is moving into Program Management. Use a Program detail page to edit players by team; this page remains available as a secondary search utility.</p>
              </div>
              <span className="rounded-full bg-navy-50 px-4 py-2 font-mono text-mono-sm uppercase text-navy-800">{players.length} player records</span>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(24rem,0.9fr)_minmax(32rem,1.1fr)]">
            <section className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <div className="grid gap-4">
                <label className="grid gap-2 font-mono text-mono-sm uppercase text-ink-500">
                  Search players
                  <span className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />
                    <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-h-11 w-full rounded-md border border-surface-300 bg-white pl-10 pr-3 text-ink-900" placeholder="Name, program, hometown, region" />
                  </span>
                </label>
                <div className="grid gap-3 md:grid-cols-3">
                  <SelectFilter label="Program" value={schoolFilter} onChange={setSchoolFilter} options={["All", ...schoolOptions]} />
                  <SelectFilter label="Sex/Gender" value={genderFilter} onChange={setGenderFilter} options={["All", "BOYS", "GIRLS"]} />
                  <SelectFilter label="Age Bracket" value={ageBracketFilter} onChange={setAgeBracketFilter} options={ageBracketOptions} />
                </div>
              </div>

              <div className="mt-5 max-h-[44rem] overflow-y-auto rounded-md border border-surface-200">
                {filteredPlayers.map((player) => (
                  <button key={player.id} type="button" onClick={() => setSelectedPlayerId(player.id)} className={`grid w-full gap-2 border-b border-surface-200 p-4 text-left last:border-b-0 hover:bg-navy-50 ${selectedPlayer?.id === player.id ? "bg-navy-50" : "bg-white"}`}>
                    <span className="flex items-center justify-between gap-3">
                      <strong className="text-ink-900">{player.displayName}</strong>
                      <span className="font-mono text-mono-sm text-ink-500">{player.gender}</span>
                    </span>
                    <span className="text-sm text-ink-500">{player.school}</span>
                    <span className="text-sm text-ink-500">{player.city}, {player.region}</span>
                    <span className="grid grid-cols-4 gap-2 font-mono text-mono-sm text-ink-600">
                      <span>{player.position || "Position missing"}</span>
                      <span>{displayHeight(player.heightCm)}</span>
                      <span>{player.displayAgeBracket}</span>
                      <span>{displayRating(player.rating)}</span>
                    </span>
                  </button>
                ))}
                {!filteredPlayers.length ? <p className="p-5 text-ink-500">No matching players.</p> : null}
              </div>
            </section>

            <section className="rounded-lg border border-surface-200 bg-white p-6 shadow-sm">
              {selectedPlayer ? <PlayerEditForm key={selectedPlayer.id} player={selectedPlayer} formAction={formAction} state={state} /> : <p className="text-ink-500">Select a player to edit.</p>}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function PlayerEditForm({ player, formAction, state }: { player: ManagedPlayer; formAction: (payload: FormData) => void; state: UpdatePlayerBioState }) {
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
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="playerId" value={player.id} />
      <div className="flex items-start gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-navy-50 text-navy-800"><UserRound className="h-7 w-7" aria-hidden="true" /></span>
        <div>
          <p className="label">Secondary Player Editor</p>
          <h2 className="font-display text-3xl text-navy-800">{player.displayName}</h2>
          <p className="mt-1 text-ink-500">Rating {displayRating(player.rating)} - {player.verifiedGameCount ?? "-"} verified games</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p>This editor remains available for transition. Prefer editing players from their Program detail page so team and Program context is visible.</p>
      </div>

      {state.message ? <p className={`rounded-md p-3 font-semibold ${state.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{state.message}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <TextField name="displayName" label="Display name" defaultValue={player.displayName} required maxLength={120} />
        <ReadonlyField label="Gender" value={player.gender} />
        <TextField name="firstName" label="First name" defaultValue={player.firstName} required maxLength={80} />
        <TextField name="lastName" label="Last name" defaultValue={player.lastName} required maxLength={80} />
        <TextField name="city" label="Hometown" defaultValue={player.city} required maxLength={100} />
        <TextField name="region" label="Region" defaultValue={player.region} required maxLength={100} />
        <TextField name="position" label="Position" defaultValue={player.position ?? ""} maxLength={20} placeholder="Optional" />
        <TextField name="schoolOverride" label="Current School / Program" defaultValue={player.schoolOverride ?? ""} maxLength={160} placeholder={player.school || "Edit only; transfer history requires migration"} />
        <ReadonlyField label="Calculated Age Bracket" value={player.computedAgeBracket ?? "Unknown"} />
        <label className="grid gap-2 text-sm font-semibold text-surface-700">
          Age Bracket Override
          <select name="ageGroupOverride" defaultValue={player.ageGroupOverride ?? ""} className="min-h-11 rounded-md border border-surface-200 px-3 py-2">
            <option value="">Use calculated</option>
            <option value="U13">U13</option>
            <option value="U16">U16</option>
            <option value="U19">U19</option>
          </select>
          <span className="text-xs font-normal text-ink-500">Display-only until rankings are recomputed or repaired.</span>
        </label>
        <div className="grid gap-2 rounded-md border border-surface-200 p-3 md:col-span-2">
          <span className="text-sm font-semibold text-surface-700">Height</span>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-surface-500">Centimeters<input name="heightCm" type="number" min={120} max={230} value={heightCm} onChange={(event) => updateHeightFromCm(event.target.value)} className="min-h-11 rounded-md border border-surface-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink-900" placeholder="Optional" /></label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-surface-500">Feet<input type="number" min={4} max={7} value={heightFeet} onChange={(event) => updateHeightFromFeetInches(event.target.value, heightInches)} className="min-h-11 rounded-md border border-surface-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink-900" placeholder="ft" /></label>
            <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.06em] text-surface-500">Inches<input type="number" min={0} max={11} value={heightInches} onChange={(event) => updateHeightFromFeetInches(heightFeet, event.target.value)} className="min-h-11 rounded-md border border-surface-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink-900" placeholder="in" /></label>
          </div>
          {heightMessage ? <span className="text-xs font-normal text-ink-500">{heightMessage}</span> : null}
        </div>
        <label className="grid gap-2 text-sm font-semibold text-surface-700">Birth date<input name="birthDate" type="date" defaultValue={player.birthDate} className="min-h-11 rounded-md border border-surface-200 px-3 py-2" /></label>
        <ReadonlyField label="Calculated Class Year" value={player.calculatedClassYear ? `Class of ${player.calculatedClassYear}` : "Not available"} />
        <label className="grid gap-2 text-sm font-semibold text-surface-700">Class Year<input name="classYear" type="number" min={2000} max={2100} defaultValue={visualClassYear ?? ""} className="min-h-11 rounded-md border border-surface-200 px-3 py-2" placeholder="Optional" /><span className="text-xs font-normal text-ink-500">Optional. If blank, class year is calculated from birth date using the March 31 cutoff.</span></label>
        <TextField name="photoUrl" label="Photo URL" defaultValue={player.photoUrl ?? ""} maxLength={500} placeholder="https://..." />
      </div>
      <SubmitButton />
    </form>
  );
}

function SelectFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="grid gap-2 font-mono text-mono-sm uppercase text-ink-500">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border border-surface-300 bg-white px-3 py-3 text-ink-900">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

function TextField({ name, label, defaultValue, required = false, maxLength, placeholder }: { name: string; label: string; defaultValue: string; required?: boolean; maxLength: number; placeholder?: string }) {
  return <label className="grid gap-2 text-sm font-semibold text-surface-700">{label}<input name={name} defaultValue={defaultValue} required={required} maxLength={maxLength} placeholder={placeholder} className="min-h-11 rounded-md border border-surface-200 px-3 py-2" /></label>;
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return <label className="grid gap-2 text-sm font-semibold text-surface-700">{label}<input value={value} readOnly className="min-h-11 rounded-md border border-surface-200 bg-surface-50 px-3 py-2 text-surface-500" /></label>;
}

function SubmitButton() {
  const status = useFormStatus();
  return <button type="submit" className="button primary w-fit" disabled={status.pending}>{status.pending ? "Saving..." : "Save Player Bio"}</button>;
}
