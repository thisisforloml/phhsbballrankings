"use client";

import { ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { type ReactNode,useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";

import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminFilterRow } from "@/components/admin/AdminFilterRow";
import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";
import type { ManagedTeam } from "@/lib/admin/managed-team";

import { updateTeamBio, type UpdateTeamState } from "./actions";

export type { ManagedTeam };

type RecordFilter = "ACTIVE" | "INACTIVE" | "NEEDS_CLEANUP";

const initialState: UpdateTeamState = { ok: false, message: "" };
const inputClassName =
  "min-h-10 w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-700/15";
const labelClassName = "text-xs font-semibold uppercase tracking-wide text-ink-500";

function teamSearchText(team: ManagedTeam) {
  return [team.name, team.publicSchoolName, team.programAbbreviation, team.programType, team.teamDisplayName, team.city, team.region, team.context, ...team.contexts]
    .join(" ")
    .toLowerCase();
}

function programSummary(team: ManagedTeam) {
  const parts = [team.publicSchoolName];
  if (team.programAbbreviation && team.programAbbreviation !== team.publicSchoolName) {
    parts.push(team.programAbbreviation);
  }
  if (team.programType) parts.push(team.programType);
  return parts.join(" · ");
}

function parseContextLine(context: string) {
  const [ageGender, league, season] = context.split(" / ").map((part) => part.trim());
  return { ageGender: ageGender || context, league: league || "—", season: season || "—" };
}

function listProgramSubtitle(team: ManagedTeam) {
  if (team.programAbbreviation && team.programAbbreviation !== team.publicSchoolName) {
    return `${team.publicSchoolName} · ${team.programAbbreviation}`;
  }
  return team.publicSchoolName;
}

function listMetaLine(team: ManagedTeam, inactive: boolean) {
  const games = team.homeGames + team.awayGames;
  if (inactive) {
    const histGames = team.historicalHomeGames + team.historicalAwayGames;
    return [
      team.context !== "No active competition context" ? team.context : null,
      histGames ? `${histGames} hist. GP` : null,
      team.historicalGameStats ? `${team.historicalGameStats} hist. stats` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return [
    team.context !== "No active competition context" ? team.context : null,
    games ? `${games} GP` : null,
    team.gameStats ? `${team.gameStats} stats` : null,
    team.playerCount ? `${team.playerCount} players` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function teamInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
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

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function TeamManagementClient({ teams }: { teams: ManagedTeam[] }) {
  const [query, setQuery] = useState("");
  const [recordFilter, setRecordFilter] = useState<RecordFilter>("ACTIVE");
  const [programFilter, setProgramFilter] = useState("All");
  const [selectedId, setSelectedId] = useState(teams.find((team) => team.isActiveCompetitionTeam)?.id ?? teams[0]?.id ?? "");
  const [state, formAction] = useFormState(updateTeamBio, initialState);

  const activeTeams = useMemo(() => teams.filter((team) => team.isActiveCompetitionTeam), [teams]);
  const inactiveTeams = useMemo(() => teams.filter((team) => !team.isActiveCompetitionTeam), [teams]);
  const reviewTeams = useMemo(() => activeTeams.filter((team) => team.needsCleanup), [activeTeams]);

  const programOptions = useMemo(() => {
    const pool = recordFilter === "INACTIVE" ? inactiveTeams : recordFilter === "NEEDS_CLEANUP" ? reviewTeams : activeTeams;
    return Array.from(new Set(pool.map((team) => team.publicSchoolName))).sort((left, right) => left.localeCompare(right));
  }, [activeTeams, inactiveTeams, recordFilter, reviewTeams]);

  const filteredTeams = useMemo(() => {
    const value = query.trim().toLowerCase();
    const pool =
      recordFilter === "INACTIVE" ? inactiveTeams : recordFilter === "NEEDS_CLEANUP" ? reviewTeams : activeTeams;

    return pool
      .filter((team) => !value || teamSearchText(team).includes(value))
      .filter((team) => programFilter === "All" || team.publicSchoolName === programFilter)
      .sort(
        (left, right) =>
          left.publicSchoolName.localeCompare(right.publicSchoolName) ||
          left.teamDisplayName.localeCompare(right.teamDisplayName) ||
          left.name.localeCompare(right.name)
      );
  }, [activeTeams, inactiveTeams, programFilter, query, recordFilter, reviewTeams]);

  const selectedTeam = teams.find((team) => team.id === selectedId) ?? filteredTeams[0] ?? null;
  const hasActiveFilters = Boolean(query.trim()) || recordFilter !== "ACTIVE" || programFilter !== "All";

  useEffect(() => {
    if (state.ok) window.location.reload();
  }, [state.ok]);

  useEffect(() => {
    if (!selectedTeam && filteredTeams[0]) setSelectedId(filteredTeams[0].id);
  }, [filteredTeams, selectedTeam]);

  useEffect(() => {
    if (programFilter !== "All" && !programOptions.includes(programFilter)) {
      setProgramFilter("All");
    }
  }, [programFilter, programOptions]);

  function clearFilters() {
    setQuery("");
    setRecordFilter("ACTIVE");
    setProgramFilter("All");
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col xl:sticky xl:top-4 xl:max-h-[calc(100vh-7rem)]">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
          <div className="relative z-10 shrink-0 border-b border-surface-200 bg-white p-3">
            <AdminFilterRow
              compact
              className="min-w-0"
              searchLabel="Search teams"
              searchPlaceholder="Team, program, city, region"
              searchValue={query}
              onSearchChange={setQuery}
              searchLeadingIcon={<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden="true" />}
              selects={[
                {
                  name: "program",
                  label: "Program",
                  value: programFilter,
                  options: ["All", ...programOptions].map((option) => ({ value: option, label: option })),
                },
                {
                  name: "status",
                  label: "Status",
                  value: recordFilter,
                  options: [
                    { value: "ACTIVE", label: `Active (${activeTeams.length})` },
                    { value: "INACTIVE", label: `Inactive (${inactiveTeams.length})` },
                    { value: "NEEDS_CLEANUP", label: `Review (${reviewTeams.length})` },
                  ],
                },
              ]}
              onSelectChange={(name, value) => {
                if (name === "status") setRecordFilter(value as RecordFilter);
                if (name === "program") setProgramFilter(value);
              }}
              onClear={clearFilters}
              showClear={hasActiveFilters}
              resultCount={filteredTeams.length}
              resultLabel="shown"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {filteredTeams.map((team) => (
              <TeamListRow
                key={team.id}
                team={team}
                selected={selectedTeam?.id === team.id}
                inactive={recordFilter === "INACTIVE"}
                onSelect={() => setSelectedId(team.id)}
              />
            ))}
            {!filteredTeams.length ? (
              <AdminEmptyState
                variant={teams.length ? "no-matches" : "no-records"}
                subject="team records"
                onClearFilters={teams.length && hasActiveFilters ? clearFilters : undefined}
              />
            ) : null}
          </div>
        </div>
      </aside>

      <main className="min-w-0">
        {selectedTeam ? (
          <TeamEditPanel key={selectedTeam.id} team={selectedTeam} formAction={formAction} state={state} />
        ) : (
          <div className="rounded-lg border border-dashed border-surface-300 bg-white p-12 text-center text-sm text-ink-500">
            Select a team from the list.
          </div>
        )}
      </main>
    </div>
  );
}

function TeamListRow({
  team,
  selected,
  inactive,
  onSelect,
}: {
  team: ManagedTeam;
  selected: boolean;
  inactive: boolean;
  onSelect: () => void;
}) {
  const meta = listMetaLine(team, inactive);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full gap-3 border-b border-surface-100 px-3 py-2.5 text-left transition last:border-b-0 hover:bg-surface-50 ${
        selected ? "bg-orange-50/50 ring-1 ring-inset ring-orange-200" : ""
      }`}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-surface-200 bg-navy-900 text-[0.65rem] font-semibold text-white">
        {teamInitials(team.teamDisplayName)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <strong className="truncate text-sm font-semibold leading-snug text-ink-900">{team.teamDisplayName}</strong>
          {team.needsCleanup ? <MetaChip tone="warning">Review</MetaChip> : null}
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-500">{listProgramSubtitle(team)}</span>
        {meta ? <span className="mt-1 block truncate text-xs text-ink-400">{meta}</span> : null}
      </span>
    </button>
  );
}

function TeamEditPanel({
  team,
  formAction,
  state,
}: {
  team: ManagedTeam;
  formAction: (payload: FormData) => void;
  state: UpdateTeamState;
}) {
  const games = team.homeGames + team.awayGames;
  const profileHref = `/teams/${team.id}`;

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">Team record</p>
            <h2 className="mt-1 font-display text-2xl text-navy-900">{team.teamDisplayName}</h2>
            <p className="mt-1 text-sm text-ink-600">{programSummary(team)}</p>
            {team.name !== team.teamDisplayName ? (
              <p className="mt-1 font-mono text-xs text-ink-500">Record: {team.name}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {team.needsCleanup ? (
              <AdminBadge variant="warning" size="sm">
                Needs review
              </AdminBadge>
            ) : team.isActiveCompetitionTeam ? (
              <AdminBadge variant="success" size="sm">
                Active
              </AdminBadge>
            ) : (
              <AdminBadge variant="readOnly" size="sm">
                Inactive
              </AdminBadge>
            )}
            <Link
              href={profileHref}
              target="_blank"
              prefetch={false}
              className="inline-flex items-center gap-1.5 border border-surface-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-orange-400 hover:text-orange-700"
            >
              Public profile
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <FormSection title="Competition & activity">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(10rem,0.6fr)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Context</p>
            {team.contexts.length ? (
              <div className="mt-2 overflow-hidden rounded-md border border-surface-200">
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
              <p className="mt-2 text-sm text-ink-500">No active competition context linked to this record.</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Activity</p>
            <dl className="mt-2 grid gap-2 text-sm text-ink-700">
              {team.isActiveCompetitionTeam ? (
                <>
                  <div className="flex justify-between gap-3 border-b border-surface-100 pb-2">
                    <dt className="text-ink-500">Games</dt>
                    <dd className="font-semibold text-ink-900">{games}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-surface-100 pb-2">
                    <dt className="text-ink-500">Stat rows</dt>
                    <dd className="font-semibold text-ink-900">{team.gameStats}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Players</dt>
                    <dd className="font-semibold text-ink-900">{team.playerCount}</dd>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between gap-3 border-b border-surface-100 pb-2">
                    <dt className="text-ink-500">Hist. home games</dt>
                    <dd className="font-semibold text-ink-900">{team.historicalHomeGames}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-b border-surface-100 pb-2">
                    <dt className="text-ink-500">Hist. away games</dt>
                    <dd className="font-semibold text-ink-900">{team.historicalAwayGames}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Hist. stat rows</dt>
                    <dd className="font-semibold text-ink-900">{team.historicalGameStats}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>
        </div>
      </FormSection>

      {team.playerNames.length ? (
        <FormSection title={`Roster preview (${team.playerNames.length})`}>
          <ul className="max-h-40 overflow-y-auto rounded-md border border-surface-200 bg-surface-50 p-3">
            <div className="flex flex-wrap gap-1.5">
              {team.playerNames.map((name) => (
                <li key={name}>
                  <MetaChip>{name}</MetaChip>
                </li>
              ))}
            </div>
          </ul>
        </FormSection>
      ) : null}

      {team.needsCleanup ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          This program has more than one active team record in the same competition context. Review before editing or merging.
        </div>
      ) : null}

      <form action={formAction} className="grid gap-4">
        <FormSection title="Edit team">
          <AdminFormFeedback state={state} />
          <div className="grid gap-4">
            <label className="grid gap-1.5">
              <span className={labelClassName}>Team / moniker name</span>
              <input name="name" required maxLength={120} defaultValue={team.name} className={inputClassName} />
            </label>
            <div className="grid max-w-2xl gap-4 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className={labelClassName}>City</span>
                <input name="city" required maxLength={100} defaultValue={team.city} className={`${inputClassName} max-w-[14rem]`} />
              </label>
              <label className="grid gap-1.5">
                <span className={labelClassName}>Region</span>
                <input name="region" required maxLength={100} defaultValue={team.region} className={`${inputClassName} max-w-[10rem]`} />
              </label>
            </div>
            <label className="grid gap-1.5">
              <span className={labelClassName}>Logo URL</span>
              <input name="logoUrl" maxLength={500} defaultValue={team.logoUrl ?? ""} className={inputClassName} placeholder="Optional" />
            </label>
            <input type="hidden" name="teamId" value={team.id} />
            <AdminSaveButton label="Save team" className="w-fit" />
          </div>
        </FormSection>
      </form>
    </div>
  );
}
