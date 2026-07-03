"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { useFormState } from "react-dom";

import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";
import type {
  ManagedCompetition,
  ManagedDivision,
  ManagedSeason,
} from "@/lib/admin/competition-management/types";
import type { CompetitionAnalytics } from "@/lib/admin/load-competition-detail";

import {
  archiveCompetition,
  archiveDivision,
  archiveSeason,
  type CompetitionActionState,
  createDivision,
  createSeason,
  updateCompetition,
  updateDivision,
  updateSeason,
} from "../actions";

const initialState: CompetitionActionState = { ok: false, message: "" };
const inputClassName =
  "min-h-10 w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm";
const labelClassName = "text-xs font-semibold uppercase tracking-wide text-ink-500";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <h2 className="font-display text-lg font-bold text-navy-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function CompetitionDetailClient({
  competition,
  seasons,
  divisions,
  analytics,
}: {
  competition: ManagedCompetition;
  seasons: ManagedSeason[];
  divisions: ManagedDivision[];
  analytics: CompetitionAnalytics;
}) {
  const [tab, setTab] = useState<"overview" | "settings" | "seasons" | "divisions">("overview");
  const divisionsBySeason = useMemo(() => {
    const map = new Map<string, ManagedDivision[]>();
    for (const division of divisions) {
      const bucket = map.get(division.seasonId) ?? [];
      bucket.push(division);
      map.set(division.seasonId, bucket);
    }
    return map;
  }, [divisions]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: "overview" as const, label: "Overview" },
          { id: "settings" as const, label: "Settings" },
          { id: "seasons" as const, label: "Seasons" },
          { id: "divisions" as const, label: "Divisions" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              tab === item.id ? "bg-navy-900 text-white" : "bg-surface-100 text-ink-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Coverage">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Metric label="Seasons" value={analytics.seasonCount} />
              <Metric label="Divisions" value={analytics.divisionCount} />
              <Metric label="Teams" value={analytics.teamCount} />
              <Metric label="Games" value={analytics.gameCount} />
              <Metric label="Verified games" value={analytics.verifiedGameCount} />
              <Metric label="Players" value={analytics.playerCount} />
              <Metric label="Ratings" value={analytics.ratingCount} />
              <Metric label="Verified rate" value={`${analytics.coverage.verifiedRate}%`} />
              <Metric label="Games with division" value={analytics.coverage.gamesWithDivision} />
              <Metric label="Games without division" value={analytics.coverage.gamesWithoutDivision} />
            </dl>
            <p className="mt-3 text-sm text-ink-500">Read-only analytics. No writes from this panel.</p>
          </Section>
          <Section title="Recent imports">
            {analytics.recentImports.length ? (
              <ul className="space-y-2 text-sm">
                {analytics.recentImports.map((row) => (
                  <li key={row.id} className="rounded-md border border-surface-200 px-3 py-2">
                    <p className="font-semibold text-ink-900">{row.title}</p>
                    <p className="text-ink-500">
                      {row.status} · {row.createdAt.slice(0, 10)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-500">No import records linked yet.</p>
            )}
            <Link href="/admin/imports" className="mt-3 inline-block text-sm font-semibold text-orange-700">
              Open Import Center
            </Link>
          </Section>
          <Section title="Recent games">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-surface-200 text-xs uppercase tracking-wide text-ink-500">
                    <th className="px-2 py-2">Game</th>
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">Division</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.recentGames.map((game) => (
                    <tr key={game.id} className="border-b border-surface-100">
                      <td className="px-2 py-2">
                        {game.homeTeamName} vs {game.awayTeamName}
                      </td>
                      <td className="px-2 py-2">{game.gameDate}</td>
                      <td className="px-2 py-2">{game.divisionName ?? "—"}</td>
                      <td className="px-2 py-2">{game.verificationStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      ) : null}

      {tab === "settings" ? (
        <CompetitionSettingsForm competition={competition} />
      ) : null}

      {tab === "seasons" ? (
        <div className="grid gap-4">
          <SeasonCreateForm competitionId={competition.id} />
          {seasons.map((season) => (
            <SeasonCard key={season.id} competitionId={competition.id} season={season} />
          ))}
        </div>
      ) : null}

      {tab === "divisions" ? (
        <div className="grid gap-4">
          {seasons.map((season) => (
            <Section key={season.id} title={`${season.name} divisions`}>
              <DivisionCreateForm competitionId={competition.id} seasonId={season.id} />
              <div className="mt-4 grid gap-3">
                {(divisionsBySeason.get(season.id) ?? []).map((division) => (
                  <DivisionCard
                    key={division.id}
                    competitionId={competition.id}
                    seasonId={season.id}
                    division={division}
                  />
                ))}
                {!divisionsBySeason.get(season.id)?.length ? (
                  <p className="text-sm text-ink-500">No divisions for this season.</p>
                ) : null}
              </div>
            </Section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className={labelClassName}>{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-navy-900">{value}</dd>
    </div>
  );
}

function CompetitionSettingsForm({ competition }: { competition: ManagedCompetition }) {
  const [updateState, updateAction] = useFormState(updateCompetition, initialState);
  const [archiveState, archiveAction] = useFormState(archiveCompetition, initialState);

  return (
    <div className="grid gap-4">
      <Section title="Competition settings">
        <form action={updateAction} className="grid gap-3 lg:grid-cols-2">
          <AdminFormFeedback state={updateState} />
          <input type="hidden" name="competitionId" value={competition.id} />
          <label className="grid gap-1.5 lg:col-span-2">
            <span className={labelClassName}>Name</span>
            <input name="name" defaultValue={competition.name} required maxLength={160} className={inputClassName} />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Short name</span>
            <input name="shortName" defaultValue={competition.shortName ?? ""} maxLength={40} className={inputClassName} />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Organization</span>
            <input name="organization" defaultValue={competition.organization} required maxLength={160} className={inputClassName} />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Season type</span>
            <select name="seasonType" defaultValue={competition.seasonType ?? ""} className={inputClassName}>
              <option value="">Not set</option>
              <option value="ACADEMIC">Academic</option>
              <option value="CALENDAR">Calendar</option>
              <option value="TOURNAMENT">Tournament</option>
              <option value="YEAR_ROUND">Year round</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Status</span>
            <select name="status" defaultValue={competition.status} className={inputClassName}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Country</span>
            <input name="country" defaultValue={competition.country ?? ""} maxLength={80} className={inputClassName} />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Region</span>
            <input name="region" defaultValue={competition.region ?? ""} maxLength={100} className={inputClassName} />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Sport</span>
            <select name="sport" defaultValue={competition.sport ?? "BASKETBALL"} className={inputClassName}>
              <option value="BASKETBALL">Basketball</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Tier</span>
            <input name="tier" type="number" min={1} max={4} defaultValue={competition.tier} className={inputClassName} />
          </label>
          <fieldset className="grid gap-2 lg:col-span-2">
            <legend className={labelClassName}>Default age groups</legend>
            {["U13", "U16", "U19"].map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="defaultAgeGroups"
                  value={value}
                  defaultChecked={competition.defaultAgeGroups.includes(value as never)}
                />
                {value}
              </label>
            ))}
          </fieldset>
          <fieldset className="grid gap-2 lg:col-span-2">
            <legend className={labelClassName}>Default genders</legend>
            {["BOYS", "GIRLS"].map((value) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="defaultGenders"
                  value={value}
                  defaultChecked={competition.defaultGenders.includes(value as never)}
                />
                {value}
              </label>
            ))}
          </fieldset>
          <label className="grid gap-1.5 lg:col-span-2">
            <span className={labelClassName}>Logo URL</span>
            <input name="logoUrl" defaultValue={competition.logoUrl ?? ""} maxLength={500} className={inputClassName} />
          </label>
          <label className="grid gap-1.5 lg:col-span-2">
            <span className={labelClassName}>Website</span>
            <input name="website" defaultValue={competition.website ?? ""} maxLength={500} className={inputClassName} />
          </label>
          <label className="grid gap-1.5 lg:col-span-2">
            <span className={labelClassName}>Notes</span>
            <textarea name="notes" defaultValue={competition.notes ?? ""} maxLength={2000} rows={3} className={inputClassName} />
          </label>
          <AdminSaveButton label="Save competition" className="w-fit lg:col-span-2" />
        </form>
      </Section>
      <Section title="Archive competition">
        <form action={archiveAction} className="grid gap-3 max-w-lg">
          <AdminFormFeedback state={archiveState} />
          <input type="hidden" name="competitionId" value={competition.id} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="confirmArchive" />
            Soft-delete this competition (historical games are preserved)
          </label>
          <AdminSaveButton label="Archive competition" className="w-fit" />
        </form>
      </Section>
    </div>
  );
}

function SeasonCreateForm({ competitionId }: { competitionId: string }) {
  const [state, action] = useFormState(createSeason, initialState);
  return (
    <Section title="Create season">
      <form action={action} className="grid gap-3 md:grid-cols-2">
        <AdminFormFeedback state={state} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <label className="grid gap-1.5 md:col-span-2">
          <span className={labelClassName}>Name</span>
          <input name="name" required maxLength={120} className={inputClassName} placeholder="Season 88" />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Season number</span>
          <input name="seasonNumber" type="number" min={1} max={200} className={inputClassName} placeholder="88" />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Year</span>
          <input name="seasonYear" type="number" min={2000} max={2100} required className={inputClassName} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Start</span>
          <input name="startsOn" type="date" required className={inputClassName} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>End</span>
          <input name="endsOn" type="date" className={inputClassName} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Status</span>
          <select name="status" defaultValue="UPCOMING" className={inputClassName}>
            <option value="UPCOMING">Upcoming</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="isCurrent" />
          Mark as current season
        </label>
        <AdminSaveButton label="Create season" className="w-fit md:col-span-2" />
      </form>
    </Section>
  );
}

function SeasonCard({ competitionId, season }: { competitionId: string; season: ManagedSeason }) {
  const [state, action] = useFormState(updateSeason, initialState);
  const [archiveState, archiveAction] = useFormState(archiveSeason, initialState);

  return (
    <Section title={season.name}>
      <form action={action} className="grid gap-3 md:grid-cols-2">
        <AdminFormFeedback state={state} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={season.id} />
        <label className="grid gap-1.5 md:col-span-2">
          <span className={labelClassName}>Name</span>
          <input name="name" defaultValue={season.name} required maxLength={120} className={inputClassName} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Season number</span>
          <input name="seasonNumber" type="number" defaultValue={season.seasonNumber ?? ""} className={inputClassName} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Year</span>
          <input name="seasonYear" type="number" defaultValue={season.seasonYear} required className={inputClassName} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Start</span>
          <input name="startsOn" type="date" defaultValue={season.startsOn} required className={inputClassName} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>End</span>
          <input name="endsOn" type="date" defaultValue={season.endsOn ?? ""} className={inputClassName} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Status</span>
          <select name="status" defaultValue={season.status} className={inputClassName}>
            <option value="UPCOMING">Upcoming</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isCurrent" defaultChecked={season.isCurrent} />
          Current season
        </label>
        <p className="text-sm text-ink-500 md:col-span-2">
          {season.gameCount} games · {season.divisionCount} divisions
        </p>
        <AdminSaveButton label="Save season" className="w-fit" />
      </form>
      <form action={archiveAction} className="mt-4 grid gap-2 max-w-lg border-t border-surface-200 pt-4">
        <AdminFormFeedback state={archiveState} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={season.id} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="confirmArchive" />
          Archive season
        </label>
        <AdminSaveButton label="Archive season" className="w-fit" />
      </form>
    </Section>
  );
}

function DivisionCreateForm({ competitionId, seasonId }: { competitionId: string; seasonId: string }) {
  const [state, action] = useFormState(createDivision, initialState);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-3">
      <AdminFormFeedback state={state} />
      <input type="hidden" name="competitionId" value={competitionId} />
      <input type="hidden" name="seasonId" value={seasonId} />
      <label className="grid gap-1.5">
        <span className={labelClassName}>Name</span>
        <input name="name" required maxLength={80} className={inputClassName} placeholder="Senior" />
      </label>
      <label className="grid gap-1.5">
        <span className={labelClassName}>Age group</span>
        <select name="ageGroup" className={inputClassName} defaultValue="">
          <option value="">Any</option>
          <option value="U13">U13</option>
          <option value="U16">U16</option>
          <option value="U19">U19</option>
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className={labelClassName}>Gender</span>
        <select name="gender" className={inputClassName} defaultValue="">
          <option value="">Any</option>
          <option value="BOYS">Boys</option>
          <option value="GIRLS">Girls</option>
        </select>
      </label>
      <AdminSaveButton label="Add division" className="w-fit md:col-span-3" />
    </form>
  );
}

function DivisionCard({
  competitionId,
  seasonId,
  division,
}: {
  competitionId: string;
  seasonId: string;
  division: ManagedDivision;
}) {
  const [state, action] = useFormState(updateDivision, initialState);
  const [archiveState, archiveAction] = useFormState(archiveDivision, initialState);

  return (
    <article className="rounded-md border border-surface-200 p-3">
      <form action={action} className="grid gap-3 md:grid-cols-4">
        <AdminFormFeedback state={state} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="divisionId" value={division.id} />
        <label className="grid gap-1.5">
          <span className={labelClassName}>Name</span>
          <input name="name" defaultValue={division.name} required maxLength={80} className={inputClassName} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Age group</span>
          <select name="ageGroup" defaultValue={division.ageGroup ?? ""} className={inputClassName}>
            <option value="">Any</option>
            <option value="U13">U13</option>
            <option value="U16">U16</option>
            <option value="U19">U19</option>
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Gender</span>
          <select name="gender" defaultValue={division.gender ?? ""} className={inputClassName}>
            <option value="">Any</option>
            <option value="BOYS">Boys</option>
            <option value="GIRLS">Girls</option>
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Status</span>
          <select name="status" defaultValue={division.status} className={inputClassName}>
            <option value="ACTIVE">Active</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="COMPLETED">Completed</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        <p className="text-sm text-ink-500 md:col-span-4">{division.gameCount} games</p>
        <AdminSaveButton label="Save division" className="w-fit" />
      </form>
      <form action={archiveAction} className="mt-3 flex flex-wrap items-center gap-3">
        <AdminFormFeedback state={archiveState} />
        <input type="hidden" name="competitionId" value={competitionId} />
        <input type="hidden" name="seasonId" value={seasonId} />
        <input type="hidden" name="divisionId" value={division.id} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="confirmArchive" />
          Archive
        </label>
        <AdminSaveButton label="Archive division" className="w-fit" />
      </form>
    </article>
  );
}
