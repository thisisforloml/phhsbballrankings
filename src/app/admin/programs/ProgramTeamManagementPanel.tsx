"use client";

import type { ProgramRole } from "@prisma/client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";

import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";
import type { ProgramManagedTeamRow } from "@/lib/admin/program-team-management";
import type { ProgramTeamOption } from "@/lib/admin/program-team-membership";

import { updateTeamBio, type UpdateTeamState } from "../teams/actions";
import {
  assignProgramTeam,
  createProgramTeam,
  moveProgramTeam,
  type ProgramActionState,
  removeProgramTeam,
} from "./actions";

const initialProgramState: ProgramActionState = { ok: false, message: "" };
const initialTeamState: UpdateTeamState = { ok: false, message: "" };
const inputClassName =
  "min-h-10 w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-700/15";
const labelClassName = "text-xs font-semibold uppercase tracking-wide text-ink-500";
const actionButtonClassName =
  "border border-surface-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-orange-300 hover:text-orange-800";
const dangerButtonClassName =
  "border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50";

type ProgramOption = { id: string; fullName: string };
type RowAction = "edit" | "move" | null;

export function ProgramTeamManagementPanel({
  programId,
  programFullName,
  programRole,
  teams,
  teamOptions,
  programOptions,
}: {
  programId: string;
  programFullName: string;
  programRole: ProgramRole;
  teams: ProgramManagedTeamRow[];
  teamOptions: ProgramTeamOption[];
  programOptions: ProgramOption[];
}) {
  const canManageTeams = programRole === "OPERATIONAL";
  const disabledReason =
    programRole === "GROUP"
      ? "Select the Program that owns each Team and roster."
      : null;

  const [panel, setPanel] = useState<"create" | "assign" | null>(null);
  const [rowAction, setRowAction] = useState<{ teamId: string; action: RowAction } | null>(null);
  const [moveTargetProgramId, setMoveTargetProgramId] = useState(
    programOptions.find((program) => program.id !== programId)?.id ?? "",
  );
  const [addTeamId, setAddTeamId] = useState("");

  const [createState, createAction] = useFormState(createProgramTeam, initialProgramState);
  const [assignState, assignAction] = useFormState(assignProgramTeam, initialProgramState);
  const [removeState, removeAction] = useFormState(removeProgramTeam, initialProgramState);
  const [moveState, moveAction] = useFormState(moveProgramTeam, initialProgramState);
  const [editState, editAction] = useFormState(updateTeamBio, initialTeamState);

  const addableTeams = useMemo(
    () => teamOptions.filter((team) => team.programId !== programId),
    [programId, teamOptions],
  );
  const moveTargets = useMemo(
    () => programOptions.filter((program) => program.id !== programId),
    [programId, programOptions],
  );

  const editingTeam = rowAction?.action === "edit" ? teams.find((team) => team.id === rowAction.teamId) ?? null : null;
  const movingTeam = rowAction?.action === "move" ? teams.find((team) => team.id === rowAction.teamId) ?? null : null;

  useEffect(() => {
    if (createState.ok || assignState.ok || removeState.ok || moveState.ok || editState.ok) {
      window.location.reload();
    }
  }, [assignState.ok, createState.ok, editState.ok, moveState.ok, removeState.ok]);

  function toggleRowAction(teamId: string, action: Exclude<RowAction, null>) {
    setRowAction((current) => (current?.teamId === teamId && current.action === action ? null : { teamId, action }));
    setPanel(null);
  }

  return (
    <div className="grid gap-4">
      {!canManageTeams ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {disabledReason}
        </div>
      ) : null}

      <AdminFormFeedback state={createState} />
      <AdminFormFeedback state={assignState} />
      <AdminFormFeedback state={removeState} />
      <AdminFormFeedback state={moveState} />
      <AdminFormFeedback state={editState} />

      <div className="flex flex-wrap gap-2">
        {canManageTeams ? (
          <>
            <button
              type="button"
              onClick={() => {
                setPanel(panel === "create" ? null : "create");
                setRowAction(null);
              }}
              className="border border-navy-800 bg-navy-900 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-800"
            >
              Create team
            </button>
            <button
              type="button"
              onClick={() => {
                setPanel(panel === "assign" ? null : "assign");
                setRowAction(null);
              }}
              className="border border-surface-300 bg-white px-3 py-2 text-xs font-semibold text-ink-700 hover:border-orange-300"
            >
              Assign existing team
            </button>
          </>
        ) : null}
      </div>

      {panel === "create" && canManageTeams ? (
        <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-navy-900">Create team under {programFullName}</h3>
          <form action={createAction} className="mt-3 grid gap-3">
            <input type="hidden" name="programId" value={programId} />
            <label className="grid max-w-xl gap-1.5">
              <span className={labelClassName}>Team name</span>
              <input name="name" required maxLength={120} className={inputClassName} />
            </label>
            <div className="grid max-w-2xl gap-3 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className={labelClassName}>City</span>
                <input name="city" required maxLength={100} className={inputClassName} />
              </label>
              <label className="grid gap-1.5">
                <span className={labelClassName}>Region</span>
                <input name="region" required maxLength={100} className={inputClassName} />
              </label>
            </div>
            <AdminSaveButton label="Create team" variant="ops" className="w-fit" />
          </form>
        </section>
      ) : null}

      {panel === "assign" && canManageTeams ? (
        <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-navy-900">Assign existing team</h3>
          <form action={assignAction} className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <input type="hidden" name="programId" value={programId} />
            <label className="grid gap-1.5">
              <span className={labelClassName}>Team</span>
              <select
                name="teamId"
                required
                value={addTeamId}
                onChange={(event) => setAddTeamId(event.target.value)}
                className={inputClassName}
              >
                <option value="">Select team...</option>
                {addableTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                    {team.programFullName ? ` - currently ${team.programFullName}` : " - unassigned"}
                  </option>
                ))}
              </select>
            </label>
            <AdminSaveButton label="Assign team" variant="ops" className="w-fit" />
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm">
        <div className="border-b border-surface-200 bg-surface-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-navy-900">Teams ({teams.length})</h3>
          <p className="mt-1 text-sm text-ink-600">
            Current Teams. Moving a Team changes its Program only; game history stays unchanged.
          </p>
        </div>

        {teams.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="bg-surface-50 text-xs font-semibold uppercase tracking-wide text-ink-500">
                <tr>
                  <th className="px-4 py-2">Team</th>
                  <th className="px-4 py-2">Gender</th>
                  <th className="px-4 py-2">Age group</th>
                  <th className="px-4 py-2">Competitions</th>
                  <th className="px-4 py-2">Active players</th>
                  <th className="px-4 py-2">Program</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 text-ink-700">
                {teams.map((team) => (
                  <tr key={team.id} className="align-top">
                    <td className="px-4 py-3">
                      <strong className="font-semibold text-ink-900">{team.name}</strong>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {[team.city, team.region].filter(Boolean).join(", ")} - {team.officialGames} GP
                      </p>
                    </td>
                    <td className="px-4 py-3">{team.genders}</td>
                    <td className="px-4 py-3">{team.ageGroups}</td>
                    <td className="px-4 py-3">{team.competitionCount}</td>
                    <td className="px-4 py-3">{team.activePlayers}</td>
                    <td className="px-4 py-3">{team.programFullName}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => toggleRowAction(team.id, "edit")} className={actionButtonClassName}>
                          Edit
                        </button>
                        {canManageTeams && moveTargets.length ? (
                          <button type="button" onClick={() => toggleRowAction(team.id, "move")} className={actionButtonClassName}>
                            Move
                          </button>
                        ) : null}
                        {canManageTeams ? (
                          <form action={removeAction}>
                            <input type="hidden" name="programId" value={programId} />
                            <input type="hidden" name="teamId" value={team.id} />
                            <button type="submit" className={dangerButtonClassName}>
                              Remove
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-6 text-sm text-ink-500">No teams are assigned to this program yet.</p>
        )}
      </section>

      {editingTeam ? (
        <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-navy-900">Edit {editingTeam.name}</h3>
          <form action={editAction} className="mt-3 grid gap-3">
            <input type="hidden" name="teamId" value={editingTeam.id} />
            <label className="grid max-w-xl gap-1.5">
              <span className={labelClassName}>Team name</span>
              <input name="name" required maxLength={120} defaultValue={editingTeam.name} className={inputClassName} />
            </label>
            <div className="grid max-w-2xl gap-3 md:grid-cols-2">
              <label className="grid gap-1.5">
                <span className={labelClassName}>City</span>
                <input name="city" required maxLength={100} defaultValue={editingTeam.city} className={inputClassName} />
              </label>
              <label className="grid gap-1.5">
                <span className={labelClassName}>Region</span>
                <input name="region" required maxLength={100} defaultValue={editingTeam.region} className={inputClassName} />
              </label>
            </div>
            <input type="hidden" name="logoUrl" value={editingTeam.logoUrl ?? ""} />
            <div className="flex flex-wrap gap-2">
              <AdminSaveButton label="Save team" variant="ops" className="w-fit" />
              <Link href="/admin/teams" prefetch={false} className={actionButtonClassName}>
                Open in Teams
              </Link>
            </div>
          </form>
        </section>
      ) : null}

      {movingTeam && canManageTeams ? (
        <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-navy-900">Move {movingTeam.name}</h3>
          <form action={moveAction} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <input type="hidden" name="fromProgramId" value={programId} />
            <input type="hidden" name="teamId" value={movingTeam.id} />
            <label className="grid gap-1.5">
              <span className={labelClassName}>Target program</span>
              <select
                name="toProgramId"
                value={moveTargetProgramId}
                onChange={(event) => setMoveTargetProgramId(event.target.value)}
                className={inputClassName}
                required
              >
                {moveTargets.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.fullName}
                  </option>
                ))}
              </select>
            </label>
            <AdminSaveButton label="Move team" variant="ops" className="w-fit" />
          </form>
        </section>
      ) : null}
    </div>
  );
}
