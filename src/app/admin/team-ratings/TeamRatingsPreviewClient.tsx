"use client";

import { AgeGroup, PlayerGender } from "@prisma/client";
import Link from "next/link";
import { useMemo } from "react";

import { AdminAlert } from "@/components/admin/AdminAlert";
import { AdminBadge } from "@/components/admin/AdminBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminFilterChipBar } from "@/components/admin/AdminFilterChipBar";
import { useAdminFilterParams } from "@/lib/admin/useAdminFilterParams";
import type {
  AdminProgramTeamRatingBoard,
  AdminProgramTeamRatingBoardIndex
} from "@/lib/team-ratings/get-admin-program-team-rating-board";
import { formatPlayerGenderLabel } from "@/lib/team-ratings/get-admin-program-team-rating-board";

const FILTER_DEFAULTS: { ageGroup: AgeGroup; gender: PlayerGender } = {
  ageGroup: AgeGroup.U16,
  gender: PlayerGender.BOYS
};

const AGE_GROUPS = [AgeGroup.U13, AgeGroup.U16, AgeGroup.U19] as const;
const GENDERS = [PlayerGender.BOYS, PlayerGender.GIRLS] as const;

function formatComputedAt(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export function TeamRatingsPreviewClient({
  board,
  boardIndex
}: {
  board: AdminProgramTeamRatingBoard;
  boardIndex: AdminProgramTeamRatingBoardIndex[];
}) {
  const { filters, patchFilters } = useAdminFilterParams({
    defaults: FILTER_DEFAULTS,
    keys: ["ageGroup", "gender"]
  });

  const ageGroup = (Object.values(AgeGroup).includes(filters.ageGroup as AgeGroup)
    ? filters.ageGroup
    : FILTER_DEFAULTS.ageGroup) as AgeGroup;
  const gender = (Object.values(PlayerGender).includes(filters.gender as PlayerGender)
    ? filters.gender
    : FILTER_DEFAULTS.gender) as PlayerGender;

  const ageGroupChips = useMemo(
    () =>
      AGE_GROUPS.map((group) => ({
        key: group,
        label: group,
        count: boardIndex.filter((item) => item.ageGroup === group && item.gender === gender).reduce((sum, item) => sum + item.count, 0)
      })),
    [boardIndex, gender]
  );

  const genderChips = useMemo(
    () =>
      GENDERS.map((value) => ({
        key: value,
        label: formatPlayerGenderLabel(value),
        count: boardIndex.filter((item) => item.gender === value && item.ageGroup === ageGroup).reduce((sum, item) => sum + item.count, 0)
      })),
    [boardIndex, ageGroup]
  );

  const { rows, meta } = board;
  const hasWarnings = meta.missingProgramWarnings.length > 0;
  const versionWarning =
    meta.formulaVersions.length > 1 ||
    meta.evidencePolicyVersions.length > 1 ||
    meta.thresholdPolicyVersions.length > 1;

  return (
    <div className="grid gap-4">
      <AdminAlert variant="readOnly" size="md">
        Internal preview only. `TEAM_NATIONAL_RATINGS_ENABLED` remains false — this board is not public and does not affect `/teams` or `/rankings`.
      </AdminAlert>

      <div className="border border-surface-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3">
          <div>
            <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ink-500">Age group</p>
            <AdminFilterChipBar
              className="mt-2"
              items={ageGroupChips}
              activeKey={ageGroup}
              onSelect={(key) => patchFilters({ ageGroup: key as AgeGroup })}
              aria-label="Filter by age group"
            />
          </div>
          <div>
            <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ink-500">Gender</p>
            <AdminFilterChipBar
              className="mt-2"
              items={genderChips}
              activeKey={gender}
              onSelect={(key) => patchFilters({ gender: key as PlayerGender })}
              aria-label="Filter by gender"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 border border-surface-200 bg-white p-4 shadow-sm lg:grid-cols-2 xl:grid-cols-4">
        <ValidationStat label="Board size" value={String(meta.boardSize)} detail={`${meta.publicEligibleCount} public-eligible`} />
        <ValidationStat
          label="Highest rating"
          value={meta.highestRating?.toFixed(2) ?? "—"}
          detail={meta.highestProgram ?? "—"}
        />
        <ValidationStat
          label="Lowest rating"
          value={meta.lowestRating?.toFixed(2) ?? "—"}
          detail={meta.lowestProgram ?? "—"}
        />
        <ValidationStat
          label="Below threshold"
          value={String(meta.belowThresholdCount)}
          detail={meta.latestComputedAt ? `Computed ${formatComputedAt(meta.latestComputedAt)}` : "No compute timestamp"}
        />
      </div>

      {meta.duplicateProgramNameWarnings.length > 0 ? (
        <AdminAlert variant="warning" size="md" title="Duplicate program name warnings">
          {meta.duplicateProgramNameWarnings.length} name collision(s) on this board — review program identity before TR-6 cutover:{" "}
          {meta.duplicateProgramNameWarnings.map((warning) => warning.programName).join(", ")}
        </AdminAlert>
      ) : null}

      {hasWarnings ? (
        <AdminAlert variant="warning" size="md" title="Missing program warnings">
          {meta.missingProgramWarnings.length} rating row(s) reference soft-deleted programs:{" "}
          {meta.missingProgramWarnings.map((warning) => warning.programName).join(", ")}. Re-run team ratings compute before TR-6 cutover.
        </AdminAlert>
      ) : (
        <AdminAlert variant="success" size="sm">
          No soft-deleted program references on this board.
        </AdminAlert>
      )}

      {versionWarning ? (
        <AdminAlert variant="warning" size="sm">
          Mixed version stamps detected on this board — investigate before publishing.
        </AdminAlert>
      ) : null}

      {rows.length === 0 ? (
        <AdminEmptyState variant="no-records" subject="team ratings for this board" />
      ) : (
        <div className="overflow-x-auto border border-surface-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-surface-200 bg-surface-50 font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-ink-600">
              <tr>
                <th className="px-3 py-3">Rank</th>
                <th className="px-3 py-3">Program</th>
                <th className="px-3 py-3">Age</th>
                <th className="px-3 py-3">Gender</th>
                <th className="px-3 py-3 text-right">Rating</th>
                <th className="px-3 py-3 text-right">Games</th>
                <th className="px-3 py-3 text-right">Opponents</th>
                <th className="px-3 py-3">Formula</th>
                <th className="px-3 py-3">Policy</th>
                <th className="px-3 py-3">Computed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {rows.map((row) => (
                <tr key={`${row.programId}:${row.ageGroup}:${row.gender}`} className="text-ink-800">
                  <td className="px-3 py-2.5 font-bold text-navy-800">{row.rank}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/programs/${row.programId}`} prefetch={false} className="font-semibold text-orange-700 hover:text-orange-800">
                        {row.programName}
                      </Link>
                      {row.programDeleted ? <AdminBadge variant="warning">Deleted program</AdminBadge> : null}
                      {!row.publicBoardEligible ? <AdminBadge variant="warning">Below threshold</AdminBadge> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">{row.ageGroup}</td>
                  <td className="px-3 py-2.5">{formatPlayerGenderLabel(row.gender)}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-navy-900">{row.rating.toFixed(2)}</td>
                  <td className="px-3 py-2.5 text-right">{row.verifiedGameCount}</td>
                  <td className="px-3 py-2.5 text-right">{row.verifiedOpponentCount}</td>
                  <td className="px-3 py-2.5 font-mono text-[0.68rem] text-ink-600">{row.formulaVersion}</td>
                  <td className="max-w-[14rem] px-3 py-2.5 font-mono text-[0.62rem] leading-snug text-ink-600">{row.policyVersion}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-ink-500">{formatComputedAt(row.computedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ValidationStat({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-surface-200 bg-surface-50 px-3 py-3">
      <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ink-500">{label}</p>
      <p className="mt-1 font-display text-2xl text-navy-900">{value}</p>
      <p className="mt-1 text-xs text-ink-600">{detail}</p>
    </div>
  );
}
