"use client";

import type { ProgramType } from "@prisma/client";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { type ReactNode,useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";

import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";
import { AdminPlayerEditModal } from "@/components/admin/AdminPlayerEditModal";
import type { ManagedPlayer } from "@/components/admin/AdminPlayerEditPanel";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";
import { slugify } from "@/lib/format";

import { type ProgramActionState,updateProgram, updateProgramTeam } from "../actions";

const initialState: ProgramActionState = { ok: false, message: "" };
const inputClassName =
  "min-h-10 w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-700/15";
const labelClassName = "text-xs font-semibold uppercase tracking-wide text-ink-500";

type DetailTab = "program" | "teams" | "roster" | "graduates";

export type ProgramEditorData = {
  id: string;
  fullName: string;
  abbreviation: string | null;
  type: ProgramType;
  city: string | null;
  region: string | null;
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

export type RosterRow = {
  id: string;
  displayName: string;
  gender: string;
  classYear: string;
  position: string | null;
  height: string;
  profileHref: string;
  appearsInMultipleTeamSections: boolean;
};

export type ProgramTeamRosterSection = {
  team: TeamEditorData;
  players: RosterRow[];
};

export type CleanupItem = {
  title: string;
  detail: string;
  tone: "warning" | "notice";
};

export type ProgramDetailStats = {
  teamCount: number;
  playerCount: number;
  graduateCount: number;
  officialGames: number;
  gameStats: number;
};

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MetaChip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "muted" | "warning" }) {
  const toneClass =
    tone === "accent"
      ? "border-orange-200 bg-orange-50 text-orange-900"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : tone === "muted"
          ? "border-surface-200 bg-surface-100 text-ink-500"
          : "border-surface-200 bg-white text-ink-700";
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneClass}`}>{children}</span>;
}

function parseContextLine(context: string) {
  const [ageGender, league, season] = context.split(" / ").map((part) => part.trim());
  return { ageGender: ageGender || context, league: league || "—", season: season || "—" };
}

function formatList(values: string[]) {
  return values.length ? values.join(", ") : "—";
}

function DetailTabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
        active ? "border-orange-500 text-navy-900" : "border-transparent text-ink-500 hover:border-surface-300 hover:text-ink-800"
      }`}
    >
      {label}
    </button>
  );
}

function TextField({
  name,
  label,
  defaultValue,
  required = false,
  maxLength,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string;
  required?: boolean;
  maxLength: number;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className={labelClassName}>{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        className={inputClassName}
      />
    </label>
  );
}

export function ProgramDetailShell({
  programId,
  program,
  teamRows,
  teamRosterSections,
  unassignedRoster,
  graduatePlayers,
  managedPlayersById,
  schoolPrograms,
  cleanupItems,
  stats,
}: {
  programId: string;
  program: ProgramEditorData;
  teamRows: TeamEditorData[];
  teamRosterSections: ProgramTeamRosterSection[];
  unassignedRoster: RosterRow[];
  graduatePlayers: ManagedPlayer[];
  managedPlayersById: Record<string, ManagedPlayer>;
  schoolPrograms: Array<{ id: string; fullName: string }>;
  cleanupItems: CleanupItem[];
  stats: ProgramDetailStats;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("program");
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const reviewCount = cleanupItems.length;
  const editingPlayer = editingPlayerId ? managedPlayersById[editingPlayerId] ?? null : null;

  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "program", label: "Program" },
    { id: "teams", label: `Teams (${stats.teamCount})` },
    { id: "roster", label: `Roster (${stats.playerCount})` },
    { id: "graduates", label: `Graduates (${stats.graduateCount})` },
  ];

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
        <div className="border-b border-surface-200 bg-surface-50 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            <MetaChip tone="muted">{stats.teamCount} teams</MetaChip>
            <MetaChip tone="muted">{stats.playerCount} active roster</MetaChip>
            <MetaChip tone="muted">{stats.graduateCount} graduates</MetaChip>
            <MetaChip tone="muted">{stats.officialGames} games</MetaChip>
            <MetaChip tone="muted">{stats.gameStats} stat rows</MetaChip>
            {reviewCount ? <MetaChip tone="warning">{reviewCount} review notice{reviewCount === 1 ? "" : "s"}</MetaChip> : null}
          </div>
          <div className="mt-3 flex gap-1 overflow-x-auto border-b border-surface-200" role="tablist">
            {tabs.map((tab) => (
              <DetailTabButton key={tab.id} active={activeTab === tab.id} label={tab.label} onClick={() => setActiveTab(tab.id)} />
            ))}
          </div>
        </div>

        <div className="p-4">
          {activeTab === "program" ? <ProgramPanel program={program} cleanupItems={cleanupItems} /> : null}
          {activeTab === "teams" ? <ProgramTeamsPanel programId={programId} teams={teamRows} /> : null}
          {activeTab === "roster" ? (
            <PlayerRosterPanel
              sections={teamRosterSections}
              unassigned={unassignedRoster}
              onEditPlayer={setEditingPlayerId}
            />
          ) : null}
          {activeTab === "graduates" ? (
            <GraduatesPanel players={graduatePlayers} onEditPlayer={setEditingPlayerId} />
          ) : null}
        </div>
      </div>

      <AdminPlayerEditModal
        player={editingPlayer}
        programs={schoolPrograms}
        open={Boolean(editingPlayer)}
        onClose={() => setEditingPlayerId(null)}
      />
    </>
  );
}

function ProgramPanel({ program, cleanupItems }: { program: ProgramEditorData; cleanupItems: CleanupItem[] }) {
  const [state, formAction] = useFormState(updateProgram, initialState);

  useEffect(() => {
    if (state.ok) window.location.reload();
  }, [state.ok]);

  return (
    <div className="grid gap-4">
      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="programId" value={program.id} />
        <FormSection title="Program details">
          <AdminFormFeedback state={state} />
          <div className="grid max-w-3xl gap-3">
            <TextField name="fullName" label="Full name" defaultValue={program.fullName} required maxLength={180} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="max-w-[10rem]">
                <TextField name="abbreviation" label="Abbreviation" defaultValue={program.abbreviation ?? ""} maxLength={80} />
              </div>
              <div className="max-w-[10rem]">
                <label className="grid gap-1.5">
                  <span className={labelClassName}>Type</span>
                  <select name="type" defaultValue={program.type} className={inputClassName}>
                    <option value="SCHOOL">School</option>
                    <option value="CLUB">Club</option>
                    <option value="TEAM">Team</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                </label>
              </div>
              <div className="max-w-[14rem]">
                <TextField name="city" label="City" defaultValue={program.city ?? ""} maxLength={100} placeholder="Optional" />
              </div>
              <div className="max-w-[10rem]">
                <TextField name="region" label="Region" defaultValue={program.region ?? ""} maxLength={100} placeholder="Optional" />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <AdminSaveButton label="Save program" variant="ops" />
          </div>
        </FormSection>
      </form>

      {cleanupItems.length ? (
        <FormSection title="Data review">
          <p className="mb-3 text-sm text-ink-600">Read-only diagnostics. Possible duplicates require a separate approved cleanup plan.</p>
          <div className="grid gap-3">
            {cleanupItems.map((item) => (
              <div
                key={`${item.title}:${item.detail}`}
                className={`rounded-md border p-4 text-sm ${
                  item.tone === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-surface-200 bg-surface-100 text-ink-700"
                }`}
              >
                <strong className="block text-ink-900">{item.title}</strong>
                <span>{item.detail}</span>
              </div>
            ))}
          </div>
        </FormSection>
      ) : null}
    </div>
  );
}

function ProgramTeamsPanel({ programId, teams }: { programId: string; teams: TeamEditorData[] }) {
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id ?? "");
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? teams[0] ?? null;

  if (!teams.length) {
    return <p className="rounded-md border border-dashed border-surface-300 bg-surface-50 p-6 text-sm text-ink-600">No current teams linked to this program.</p>;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-lg border border-surface-200">
        {teams.map((team) => {
          const selected = selectedTeam?.id === team.id;
          const primaryContext = team.contexts[0] ? parseContextLine(team.contexts[0]).ageGender : formatList(team.ageGroups);
          return (
            <button
              key={team.id}
              type="button"
              onClick={() => setSelectedTeamId(team.id)}
              className={`flex w-full flex-col gap-1 border-b border-surface-100 px-3 py-2.5 text-left transition last:border-b-0 hover:bg-surface-50 ${
                selected ? "bg-orange-50/50 ring-1 ring-inset ring-orange-200" : ""
              }`}
            >
              <strong className="truncate text-sm font-semibold text-ink-900">{team.name}</strong>
              <span className="truncate text-xs text-ink-500">{primaryContext}</span>
              <span className="text-xs text-ink-400">
                {team.officialGames} GP · {team.activeGameStats} stats
              </span>
            </button>
          );
        })}
      </div>
      {selectedTeam ? <TeamMonikerPanel key={selectedTeam.id} programId={programId} team={selectedTeam} /> : null}
    </div>
  );
}

function TeamMonikerPanel({ programId, team }: { programId: string; team: TeamEditorData }) {
  const [state, formAction] = useFormState(updateProgramTeam, initialState);

  useEffect(() => {
    if (state.ok) window.location.reload();
  }, [state.ok]);

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-surface-200 bg-surface-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Team record</p>
        <h3 className="mt-1 font-display text-xl text-navy-900">{team.name}</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {team.ageGroups.map((value) => (
            <MetaChip key={value} tone="muted">
              {value}
            </MetaChip>
          ))}
          {team.genders.map((value) => (
            <MetaChip key={value}>{value}</MetaChip>
          ))}
        </div>
      </div>

      <FormSection title="Competition context">
        {team.contexts.length ? (
          <div className="overflow-hidden rounded-md border border-surface-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-50 text-xs font-semibold uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-3 py-2">Board</th>
                  <th className="px-3 py-2">League</th>
                  <th className="px-3 py-2">Season</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-ink-700">
                {team.contexts.map((context) => {
                  const row = parseContextLine(context);
                  return (
                    <tr key={context}>
                      <td className="px-3 py-2 font-medium text-ink-900">{row.ageGender}</td>
                      <td className="px-3 py-2">{row.league}</td>
                      <td className="px-3 py-2">{row.season}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-ink-500">No active competition context.</p>
        )}
      </FormSection>

      <FormSection title="Activity">
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Official games</dt>
            <dd className="mt-1 font-semibold text-ink-900">{team.officialGames}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Stat rows</dt>
            <dd className="mt-1 font-semibold text-ink-900">{team.activeGameStats}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Latest game</dt>
            <dd className="mt-1 font-semibold text-ink-900">{team.latestGameDate ?? "—"}</dd>
          </div>
        </dl>
      </FormSection>

      <form action={formAction} className="grid gap-3">
        <input type="hidden" name="programId" value={programId} />
        <input type="hidden" name="teamId" value={team.id} />
        <FormSection title="Edit moniker">
          <p className="mb-3 text-sm text-ink-600">Renaming updates this internal team record only. It does not merge teams or move official stats.</p>
          <TextField name="name" label="Team / moniker name" defaultValue={team.name} required maxLength={120} />
          <div className="mt-3">
            <AdminFormFeedback state={state} />
          </div>
          <div className="mt-3">
            <AdminSaveButton label="Save team moniker" variant="ops" />
          </div>
        </FormSection>
      </form>
    </div>
  );
}

function PlayerTable({
  players,
  onEditPlayer,
}: {
  players: RosterRow[];
  onEditPlayer: (playerId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-surface-200">
      <div className="hidden grid-cols-[minmax(12rem,1.4fr)_6rem_6rem_7rem_5rem] gap-3 border-b border-surface-200 bg-navy-950 px-4 py-2.5 font-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-white lg:grid">
        <span>Player</span>
        <span>Gender</span>
        <span>Class</span>
        <span>Position / height</span>
        <span className="text-right">Action</span>
      </div>
      {players.map((player) => (
        <div key={player.id} className="grid gap-2 border-b border-surface-100 px-4 py-3 last:border-b-0 lg:grid-cols-[minmax(12rem,1.4fr)_6rem_6rem_7rem_5rem] lg:items-center">
          <div className="min-w-0">
            <strong className="block truncate text-sm font-semibold text-ink-900">{player.displayName}</strong>
            <Link href={player.profileHref} target="_blank" prefetch={false} className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-orange-700 hover:text-orange-800">
              Public profile
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
            {player.appearsInMultipleTeamSections ? (
              <span className="mt-1 block text-xs font-semibold text-amber-800">Also on another team section</span>
            ) : null}
          </div>
          <span className="text-sm text-ink-600">{player.gender === "BOYS" ? "Boys" : "Girls"}</span>
          <span className="text-sm text-ink-600">{player.classYear}</span>
          <span className="text-sm text-ink-600">
            {player.position ?? "—"}
            <span className="block text-xs text-ink-400">{player.height === "Not listed" ? "—" : player.height}</span>
          </span>
          <div className="text-right">
            <button
              type="button"
              onClick={() => onEditPlayer(player.id)}
              className="rounded-md border border-surface-300 px-2.5 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-orange-300 hover:text-orange-800"
            >
              Edit
            </button>
          </div>
        </div>
      ))}
      {!players.length ? <p className="p-6 text-sm text-ink-500">No players in this section.</p> : null}
    </div>
  );
}

function PlayerRosterPanel({
  sections,
  unassigned,
  onEditPlayer,
}: {
  sections: ProgramTeamRosterSection[];
  unassigned: RosterRow[];
  onEditPlayer: (playerId: string) => void;
}) {
  const rosterSections = useMemo(() => {
    const items = sections.map((section) => ({ key: section.team.id, label: section.team.name, players: section.players }));
    if (unassigned.length) items.push({ key: "unassigned", label: "Unassigned", players: unassigned });
    return items;
  }, [sections, unassigned]);

  const [activeSectionKey, setActiveSectionKey] = useState(rosterSections[0]?.key ?? "");
  const [query, setQuery] = useState("");

  const activeSection = rosterSections.find((section) => section.key === activeSectionKey) ?? rosterSections[0] ?? null;

  const filteredPlayers = useMemo(() => {
    if (!activeSection) return [];
    const value = query.trim().toLowerCase();
    if (!value) return activeSection.players;
    return activeSection.players.filter((player) =>
      [player.displayName, player.position, player.classYear, player.gender].filter(Boolean).join(" ").toLowerCase().includes(value)
    );
  }, [activeSection, query]);

  if (!rosterSections.length) {
    return <p className="rounded-md border border-dashed border-surface-300 bg-surface-50 p-6 text-sm text-ink-600">No active roster players found for this program.</p>;
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-600">Active roster players from official game stats. Graduated players appear in the Graduates tab.</p>
      <div className="flex flex-wrap gap-1.5">
        {rosterSections.map((section) => (
          <button
            key={section.key}
            type="button"
            onClick={() => {
              setActiveSectionKey(section.key);
              setQuery("");
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              activeSection?.key === section.key
                ? "border-orange-300 bg-orange-50 text-orange-900"
                : "border-surface-200 bg-white text-ink-700 hover:border-surface-300"
            }`}
          >
            {section.label} ({section.players.length})
          </button>
        ))}
      </div>
      <label className="grid max-w-md gap-1.5">
        <span className={labelClassName}>Search players</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, position, class year" className={inputClassName} />
      </label>
      <PlayerTable players={filteredPlayers} onEditPlayer={onEditPlayer} />
    </div>
  );
}

function GraduatesPanel({
  players,
  onEditPlayer,
}: {
  players: ManagedPlayer[];
  onEditPlayer: (playerId: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filteredPlayers = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return players;
    return players.filter((player) =>
      [player.displayName, player.position, player.displayAgeBracket, player.school].filter(Boolean).join(" ").toLowerCase().includes(value)
    );
  }, [players, query]);

  const rows: RosterRow[] = filteredPlayers.map((player) => ({
    id: player.id,
    displayName: player.displayName,
    gender: player.gender,
    classYear: player.calculatedClassYear ? `Class of ${player.classYearOverride ?? player.calculatedClassYear}` : "Not listed",
    position: player.position,
    height: player.heightCm ? `${player.heightCm} cm` : "Not listed",
    profileHref: `/players/${slugify(player.displayName)}`,
    appearsInMultipleTeamSections: false,
  }));

  if (!players.length) {
    return (
      <p className="rounded-md border border-dashed border-surface-300 bg-surface-50 p-6 text-sm text-ink-600">
        No graduated players linked to this program. Graduates are players whose class year has passed the June 1 eligibility cutoff.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-ink-600">
        Players associated with this program whose class year has graduated from active U19 eligibility (June 1 cutoff). Historical stats are preserved.
      </p>
      <label className="grid max-w-md gap-1.5">
        <span className={labelClassName}>Search graduates</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, school, class year" className={inputClassName} />
      </label>
      <PlayerTable players={rows} onEditPlayer={onEditPlayer} />
    </div>
  );
}
