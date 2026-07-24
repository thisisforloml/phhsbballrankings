"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";

import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";
import type { ProgramHierarchyBreadcrumb, ProgramHierarchyChild, ProgramParentPickerOption } from "@/lib/admin/program-hierarchy";

import { type ProgramActionState,updateProgramParent } from "./actions";

const initialState: ProgramActionState = { ok: false, message: "" };
const inputClassName =
  "min-h-10 w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-700/15";
const labelClassName = "text-xs font-semibold uppercase tracking-wide text-ink-500";

export type ProgramHierarchyData = {
  programId: string;
  programFullName: string;
  parentProgramId: string | null;
  parentProgram: { id: string; fullName: string; abbreviation: string | null } | null;
  breadcrumb: ProgramHierarchyBreadcrumb[];
  childPrograms: ProgramHierarchyChild[];
  parentPickerOptions: ProgramParentPickerOption[];
};

export function ProgramHierarchyCard({ hierarchy }: { hierarchy: ProgramHierarchyData }) {
  const [state, formAction] = useFormState(updateProgramParent, initialState);
  const [parentQuery, setParentQuery] = useState("");
  const [selectedParentId, setSelectedParentId] = useState(hierarchy.parentProgramId ?? "");

  const filteredParentOptions = useMemo(() => {
    const value = parentQuery.trim().toLowerCase();
    if (!value) return hierarchy.parentPickerOptions;
    return hierarchy.parentPickerOptions.filter((option) =>
      [option.fullName, option.abbreviation].filter(Boolean).join(" ").toLowerCase().includes(value),
    );
  }, [hierarchy.parentPickerOptions, parentQuery]);

  useEffect(() => {
    if (state.ok) window.location.reload();
  }, [state.ok]);

  return (
    <details className="rounded-lg border border-surface-200 bg-white shadow-sm">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy-900">
        Organization grouping <span className="ml-2 font-normal text-ink-500">Optional</span>
      </summary>
      <div className="grid gap-4 border-t border-surface-200 p-4">
        <p className="text-sm text-ink-600">Group related Programs without moving Teams, players, games, or stats.</p>
        <div>
          <p className={labelClassName}>Program path</p>
          {hierarchy.breadcrumb.length ? (
            <p className="mt-2 text-sm text-ink-800">
              {hierarchy.breadcrumb.map((item, index) => (
                <span key={item.id}>
                  {index > 0 ? <span className="px-1 text-ink-400">/</span> : null}
                  <Link href={`/admin/programs/${item.id}`} prefetch={false} className="font-semibold text-orange-700 hover:text-orange-800">
                    {item.fullName}
                  </Link>
                </span>
              ))}
              <span className="px-1 text-ink-400">/</span>
              <span className="font-semibold text-navy-900">{hierarchy.programFullName}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm font-semibold text-navy-900">{hierarchy.programFullName}</p>
          )}
        </div>

        <div>
          <p className={labelClassName}>Belongs to</p>
          <p className="mt-2 text-sm text-ink-800">
            {hierarchy.parentProgram ? (
              <Link href={`/admin/programs/${hierarchy.parentProgram.id}`} prefetch={false} className="font-semibold text-orange-700 hover:text-orange-800">
                {hierarchy.parentProgram.fullName}
              </Link>
            ) : (
              "Independent"
            )}
          </p>
        </div>

        <div>
          <p className={labelClassName}>Programs in this organization</p>
          {hierarchy.childPrograms.length ? (
            <ul className="mt-2 grid gap-1 text-sm">
              {hierarchy.childPrograms.map((child) => (
                <li key={child.id}>
                  <Link href={`/admin/programs/${child.id}`} prefetch={false} className="font-semibold text-orange-700 hover:text-orange-800">
                    {child.fullName}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-ink-500">None</p>
          )}
        </div>

        <form action={formAction} className="grid gap-3 border-t border-surface-200 pt-4">
          <input type="hidden" name="programId" value={hierarchy.programId} />
          <AdminFormFeedback state={state} />
          <label className="grid gap-1.5">
            <span className={labelClassName}>Search organizations</span>
            <input
              value={parentQuery}
              onChange={(event) => setParentQuery(event.target.value)}
              placeholder="Filter organizations"
              className={inputClassName}
            />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Organization</span>
            <select
              name="parentProgramId"
              value={selectedParentId}
              onChange={(event) => setSelectedParentId(event.target.value)}
              className={inputClassName}
            >
              <option value="">Independent program</option>
              {filteredParentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.fullName}
                  {option.abbreviation ? ` (${option.abbreviation})` : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <AdminSaveButton label="Save organization" variant="ops" className="w-fit" />
            {hierarchy.parentProgramId ? (
              <button
                type="button"
                onClick={() => setSelectedParentId("")}
                className="border border-surface-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-700"
              >
                Clear selection
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </details>
  );
}
