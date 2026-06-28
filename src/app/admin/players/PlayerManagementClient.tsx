"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormState } from "react-dom";
import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminFilterRow } from "@/components/admin/AdminFilterRow";
import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";
import { PlayerPhotoCropper } from "@/components/admin/PlayerPhotoCropper";
import { useAdminFilterParams } from "@/lib/admin/useAdminFilterParams";
import { slugify } from "@/lib/format";
import { updatePlayerBio, updatePlayerSchool, type UpdatePlayerBioState } from "./actions";

const initialFormState: UpdatePlayerBioState = { ok: false, message: "" };
const ageBracketOptions = ["All", "U13", "U16", "U19", "Unknown"];
const FILTER_DEFAULTS = { search: "", program: "All", gender: "All", ageBracket: "All" };

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
  hometown: string;
  region: string;
  currentProgramId: string | null;
  position: string | null;
  heightCm: number | null;
  birthDate: string;
  calculatedClassYear: number | null;
  classYearOverride: number | null;
  photoUrl: string | null;
  rating: number | null;
  verifiedGameCount: number | null;
};

const inputClassName = "min-h-10 w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-700/15";
const labelClassName = "text-xs font-semibold uppercase tracking-wide text-ink-500";

function playerSearchText(player: ManagedPlayer) {
  return [player.displayName, player.firstName, player.lastName, player.school, player.hometown, player.region, player.gender, player.displayAgeBracket]
    .join(" ")
    .toLowerCase();
}

function displayHeight(heightCm: number | null) {
  if (heightCm === null) return null;
  return `${heightCm} cm`;
}

function displayRating(rating: number | null) {
  if (rating === null) return null;
  return rating.toFixed(1);
}

function playerInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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

function MetaChip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "muted" }) {
  const toneClass =
    tone === "accent"
      ? "border-orange-200 bg-orange-50 text-orange-900"
      : tone === "muted"
        ? "border-surface-200 bg-surface-100 text-ink-500"
        : "border-surface-200 bg-white text-ink-700";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function PlayerManagementClient({
  players,
  programs
}: {
  players: ManagedPlayer[];
  programs: Array<{ id: string; fullName: string }>;
}) {
  const { filters, patchFilters, clearFilters } = useAdminFilterParams({
    defaults: FILTER_DEFAULTS,
    keys: ["search", "program", "gender", "ageBracket"],
    debounceKey: "search"
  });
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id ?? "");
  const [state, formAction] = useFormState(updatePlayerBio, initialFormState);

  const query = filters.search;
  const schoolFilter = filters.program;
  const genderFilter = filters.gender;
  const ageBracketFilter = filters.ageBracket;

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
  const hasActiveFilters = Boolean(query.trim()) || schoolFilter !== "All" || genderFilter !== "All" || ageBracketFilter !== "All";

  useEffect(() => {
    if (!selectedPlayer && filteredPlayers[0]) setSelectedPlayerId(filteredPlayers[0].id);
  }, [filteredPlayers, selectedPlayer]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
      <aside className="flex flex-col gap-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-7rem)]">
        <div className="min-w-0 overflow-hidden rounded-lg border border-surface-200 bg-white p-3 shadow-sm">
          <AdminFilterRow
            className="min-w-0"
            searchLabel="Search players"
            searchPlaceholder="Name, program, hometown"
            searchValue={query}
            onSearchChange={(value) => patchFilters({ search: value })}
            searchLeadingIcon={<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />}
            selects={[
              {
                name: "program",
                label: "Program",
                value: schoolFilter,
                options: ["All", ...schoolOptions].map((option) => ({ value: option, label: option }))
              },
              {
                name: "gender",
                label: "Gender",
                value: genderFilter,
                options: ["All", "BOYS", "GIRLS"].map((option) => ({ value: option, label: option }))
              },
              {
                name: "ageBracket",
                label: "Age",
                value: ageBracketFilter,
                options: ageBracketOptions.map((option) => ({ value: option, label: option }))
              }
            ]}
            onSelectChange={(name, value) => patchFilters({ [name]: value } as Partial<typeof FILTER_DEFAULTS>)}
            onClear={clearFilters}
            showClear={hasActiveFilters}
            resultCount={filteredPlayers.length}
            resultLabel="shown"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-surface-200 bg-white shadow-sm">
          {filteredPlayers.map((player) => {
            const selected = selectedPlayer?.id === player.id;
            const rating = displayRating(player.rating);
            return (
              <button
                key={player.id}
                type="button"
                onClick={() => setSelectedPlayerId(player.id)}
                className={`flex w-full gap-3 border-b border-surface-100 px-3 py-3 text-left transition last:border-b-0 hover:bg-surface-50 ${selected ? "border-l-4 border-l-orange-500 bg-orange-50/40 pl-2" : "border-l-4 border-l-transparent"}`}
              >
                <PlayerAvatar photoUrl={player.photoUrl} name={player.displayName} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <strong className="truncate text-sm font-semibold text-ink-900">{player.displayName}</strong>
                    <span className="shrink-0 text-[0.65rem] font-semibold uppercase text-ink-400">{player.gender === "BOYS" ? "B" : "G"}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-ink-500">{player.school}</span>
                  <span className="mt-2 flex flex-wrap gap-1">
                    <MetaChip tone="muted">{player.displayAgeBracket}</MetaChip>
                    {rating ? <MetaChip tone="accent">{rating}</MetaChip> : null}
                    {player.position ? <MetaChip>{player.position}</MetaChip> : null}
                  </span>
                </span>
              </button>
            );
          })}
          {!filteredPlayers.length ? (
            <AdminEmptyState
              variant={players.length ? "no-matches" : "no-records"}
              subject="players"
              onClearFilters={players.length && hasActiveFilters ? clearFilters : undefined}
            />
          ) : null}
        </div>
      </aside>

      <main className="min-w-0">
        {selectedPlayer ? (
          <PlayerEditPanel key={selectedPlayer.id} player={selectedPlayer} programs={programs} formAction={formAction} state={state} />
        ) : (
          <div className="rounded-lg border border-dashed border-surface-300 bg-white p-12 text-center text-sm text-ink-500">Select a player from the list.</div>
        )}
      </main>
    </div>
  );
}

function PlayerAvatar({ photoUrl, name, size = "md" }: { photoUrl: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "lg" ? "size-20 text-xl" : size === "sm" ? "size-10 text-xs" : "size-14 text-sm";
  if (photoUrl) {
    return (
      <span className={`${sizeClass} shrink-0 overflow-hidden rounded-full border border-surface-200 bg-surface-100`}>
        <img src={photoUrl} alt="" className="h-full w-full object-cover object-top" />
      </span>
    );
  }
  return (
    <span className={`${sizeClass} grid shrink-0 place-items-center rounded-full border border-surface-200 bg-navy-900 font-semibold text-white`}>
      {playerInitials(name)}
    </span>
  );
}

function PlayerEditPanel({
  player,
  programs,
  formAction,
  state
}: {
  player: ManagedPlayer;
  programs: Array<{ id: string; fullName: string }>;
  formAction: (payload: FormData) => void;
  state: UpdatePlayerBioState;
}) {
  const [activeTab, setActiveTab] = useState<"profile" | "school">("profile");
  const hasSchool = Boolean(player.currentProgramId);
  const [schoolChangeMode, setSchoolChangeMode] = useState<"assign" | "transfer">(hasSchool ? "transfer" : "assign");
  const [schoolState, schoolAction] = useFormState(updatePlayerSchool, initialFormState);
  const initialHeight = cmToFeetInches(player.heightCm);
  const [heightCm, setHeightCm] = useState(player.heightCm === null ? "" : String(player.heightCm));
  const [heightFeet, setHeightFeet] = useState(initialHeight.feet);
  const [heightInches, setHeightInches] = useState(initialHeight.inches);
  const [heightMessage, setHeightMessage] = useState("");
  const visualClassYear = player.classYearOverride ?? player.calculatedClassYear;
  const ratingLabel = displayRating(player.rating);
  const gamesLabel = player.verifiedGameCount ?? 0;
  const profileHref = `/players/${slugify(player.displayName)}`;

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
      setHeightMessage("Height must be 120–230 cm.");
      return;
    }
    const converted = cmToFeetInches(parsed);
    setHeightFeet(converted.feet);
    setHeightInches(converted.inches);
    setHeightMessage(`${converted.feet}'${converted.inches}"`);
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
      setHeightMessage("Use feet 4–7 and inches 0–11.");
      return;
    }
    const cm = feetInchesToCm(nextFeet, nextInches);
    setHeightCm(cm);
    setHeightMessage(`${cm} cm`);
  }

  useEffect(() => {
    setSchoolChangeMode(hasSchool ? "transfer" : "assign");
  }, [player.id, hasSchool]);

  useEffect(() => {
    if (schoolState.ok) window.location.reload();
  }, [schoolState.ok]);

  return (
    <div className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
      <div className="border-b border-surface-200 bg-gradient-to-r from-navy-900 to-navy-800 px-5 py-5 text-white">
        <div className="flex flex-wrap items-start gap-4">
          <PlayerAvatar photoUrl={player.photoUrl} name={player.displayName} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="font-display text-2xl font-bold leading-tight">{player.displayName}</h2>
              <Link href={profileHref} target="_blank" className="inline-flex items-center gap-1 rounded-md border border-white/25 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20">
                Public profile
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-1 text-sm text-white/80">{player.school}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <MetaChip tone="accent">{player.gender}</MetaChip>
              <MetaChip>{player.displayAgeBracket}</MetaChip>
              {player.position ? <MetaChip>{player.position}</MetaChip> : null}
              {displayHeight(player.heightCm) ? <MetaChip>{displayHeight(player.heightCm)}</MetaChip> : null}
            </div>
            <p className="mt-3 text-sm text-white/70">
              {ratingLabel ? <>Rating <strong className="text-white">{ratingLabel}</strong> · </> : null}
              <strong className="text-white">{gamesLabel}</strong> verified {gamesLabel === 1 ? "game" : "games"}
            </p>
          </div>
        </div>

        <div className="mt-5 flex gap-1 border-b border-white/10" role="tablist">
          {[
            { id: "profile" as const, label: "Profile" },
            { id: "school" as const, label: "Assign / Transfer" }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-4 py-2 text-sm font-semibold transition ${activeTab === tab.id ? "border-orange-400 text-white" : "border-transparent text-white/60 hover:text-white"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-surface-50 p-5">
        {activeTab === "profile" ? (
          <form action={formAction} className="grid gap-4" encType="multipart/form-data">
            <input type="hidden" name="playerId" value={player.id} />
            <AdminFormFeedback state={state} />

            <div className="grid gap-4 lg:grid-cols-2">
              <FormSection title="Identity">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField name="displayName" label="Display name" defaultValue={player.displayName} required maxLength={120} />
                  <ReadonlyField label="Gender" value={player.gender} />
                  <TextField name="firstName" label="First name" defaultValue={player.firstName} required maxLength={80} />
                  <TextField name="lastName" label="Family name" defaultValue={player.lastName} required maxLength={80} />
                </div>
              </FormSection>

              <FormSection title="Location">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField name="hometown" label="Hometown" defaultValue={player.hometown} required maxLength={100} />
                  <TextField name="region" label="Plays in (region)" defaultValue={player.region} required maxLength={100} />
                </div>
              </FormSection>
            </div>

            <FormSection title="Athlete details">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <TextField name="position" label="Position" defaultValue={player.position ?? ""} maxLength={20} placeholder="e.g. G, F" />
                <ReadonlyField label="Age bracket (calc.)" value={player.computedAgeBracket ?? "Needs birth date"} />
                <label className="grid gap-1.5">
                  <span className={labelClassName}>Age bracket override</span>
                  <select name="ageGroupOverride" defaultValue={player.ageGroupOverride ?? ""} className={inputClassName}>
                    <option value="">Use calculated</option>
                    <option value="U13">U13</option>
                    <option value="U16">U16</option>
                    <option value="U19">U19</option>
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className={labelClassName}>Birth date</span>
                  <input name="birthDate" type="date" defaultValue={player.birthDate} className={inputClassName} />
                </label>
                <ReadonlyField label="Class year (calc.)" value={player.calculatedClassYear ? `Class of ${player.calculatedClassYear}` : "Needs birth date"} />
                <label className="grid gap-1.5">
                  <span className={labelClassName}>Class year override</span>
                  <input name="classYear" type="number" min={2000} max={2100} defaultValue={visualClassYear ?? ""} className={inputClassName} placeholder="Optional" />
                </label>
              </div>

              <div className="mt-4 rounded-md border border-surface-200 bg-surface-50 p-3">
                <span className={labelClassName}>Height</span>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1.5">
                    <span className="text-xs text-ink-500">Centimeters</span>
                    <input name="heightCm" type="number" min={120} max={230} value={heightCm} onChange={(event) => updateHeightFromCm(event.target.value)} className={inputClassName} placeholder="Optional" />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs text-ink-500">Feet</span>
                    <input type="number" min={4} max={7} value={heightFeet} onChange={(event) => updateHeightFromFeetInches(event.target.value, heightInches)} className={inputClassName} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs text-ink-500">Inches</span>
                    <input type="number" min={0} max={11} value={heightInches} onChange={(event) => updateHeightFromFeetInches(heightFeet, event.target.value)} className={inputClassName} />
                  </label>
                </div>
                {heightMessage ? <p className="mt-2 text-xs text-ink-500">{heightMessage}</p> : null}
              </div>
            </FormSection>

            <FormSection title="Photo">
              <div className="flex flex-wrap items-start gap-4">
                <PlayerAvatar photoUrl={player.photoUrl} name={player.displayName} size="lg" />
                <div className="min-w-0 flex-1 grid gap-3">
                  <input type="hidden" name="photoUrl" value={player.photoUrl ?? ""} />
                  <PlayerPhotoCropper currentPhotoUrl={player.photoUrl} />
                  {player.photoUrl ? (
                    <label className="flex items-center gap-2 text-sm text-ink-700">
                      <input type="checkbox" name="clearPhoto" />
                      Remove current photo
                    </label>
                  ) : null}
                </div>
              </div>
            </FormSection>

            <div className="sticky bottom-0 -mx-5 border-t border-surface-200 bg-white/95 px-5 py-3 backdrop-blur">
              <AdminSaveButton label="Save profile" className="w-fit" />
            </div>
          </form>
        ) : (
          <section className="grid max-w-xl gap-4">
            <div className="rounded-lg border border-surface-200 bg-white p-4">
              <h3 className="font-semibold text-navy-900">Assign / Transfer school</h3>
              <p className="mt-1 text-sm text-ink-600">
                Assign sets a player&apos;s school when none is on record. Transfer moves them from one school to another. Club and team rosters are not changed. Game stats are never rewritten.
              </p>
            </div>
            <AdminFormFeedback state={schoolState} />
            <form action={schoolAction} className="grid gap-4 rounded-lg border border-surface-200 bg-white p-4">
              <input type="hidden" name="playerId" value={player.id} />
              <input type="hidden" name="schoolChangeMode" value={schoolChangeMode.toUpperCase()} />
              {schoolChangeMode === "transfer" && player.currentProgramId ? (
                <input type="hidden" name="fromProgramId" value={player.currentProgramId} />
              ) : null}

              <fieldset className="grid gap-2">
                <legend className={labelClassName}>Action</legend>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-ink-800">
                    <input
                      type="radio"
                      name="schoolChangeModeUi"
                      checked={schoolChangeMode === "assign"}
                      onChange={() => setSchoolChangeMode("assign")}
                      disabled={hasSchool}
                    />
                    Assign school
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-ink-800">
                    <input
                      type="radio"
                      name="schoolChangeModeUi"
                      checked={schoolChangeMode === "transfer"}
                      onChange={() => setSchoolChangeMode("transfer")}
                      disabled={!hasSchool}
                    />
                    Transfer school
                  </label>
                </div>
                {hasSchool ? (
                  <p className="text-xs text-ink-500">This player already has a school on record. Use Transfer to change it.</p>
                ) : (
                  <p className="text-xs text-ink-500">No school assigned yet. Use Assign to set their school.</p>
                )}
              </fieldset>

              {schoolChangeMode === "transfer" ? (
                <ReadonlyField label="Origin school" value={player.school || "Not assigned"} />
              ) : null}

              <label className="grid gap-1.5">
                <span className={labelClassName}>{schoolChangeMode === "transfer" ? "Target school" : "School"}</span>
                <select
                  name="nextProgramId"
                  defaultValue=""
                  required
                  className={inputClassName}
                  key={`${player.id}-${schoolChangeMode}`}
                >
                  <option value="" disabled>
                    Select school
                  </option>
                  {programs
                    .filter((program) => schoolChangeMode !== "transfer" || program.id !== player.currentProgramId)
                    .map((program) => (
                      <option key={program.id} value={program.id}>
                        {program.fullName}
                      </option>
                    ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <span className={labelClassName}>Effective date</span>
                  <input name="effectiveDate" type="date" required className={inputClassName} />
                </label>
                <label className="grid gap-1.5">
                  <span className={labelClassName}>Note</span>
                  <input name="transferNote" maxLength={500} className={inputClassName} placeholder="Optional" />
                </label>
              </div>
              <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <input type="checkbox" name="confirmSchoolChange" required className="mt-0.5" />
                <span>
                  {schoolChangeMode === "transfer"
                    ? "I confirm this school transfer. Historical stats remain on their original teams."
                    : "I confirm this school assignment. Historical stats remain on their original teams."}
                </span>
              </label>
              <AdminSaveButton
                label={schoolChangeMode === "transfer" ? "Transfer school" : "Assign school"}
                className="w-fit"
              />
            </form>
          </section>
        )}
      </div>
    </div>
  );
}

function TextField({ name, label, defaultValue, required = false, maxLength, placeholder }: { name: string; label: string; defaultValue: string; required?: boolean; maxLength: number; placeholder?: string }) {
  return (
    <label className="grid gap-1.5">
      <span className={labelClassName}>{label}</span>
      <input name={name} defaultValue={defaultValue} required={required} maxLength={maxLength} placeholder={placeholder} className={inputClassName} />
    </label>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="grid gap-1.5">
      <span className={labelClassName}>{label}</span>
      <input value={value} readOnly className={`${inputClassName} bg-surface-50 text-ink-500`} />
    </label>
  );
}
