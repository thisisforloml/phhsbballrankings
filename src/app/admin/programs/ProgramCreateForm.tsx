"use client";

import { ProgramRole } from "@prisma/client";
import { useEffect, useState } from "react";
import { useFormState } from "react-dom";

import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";

import { createProgram, type ProgramActionState } from "./actions";

const initialState: ProgramActionState = { ok: false, message: "" };
const inputClassName =
  "min-h-10 w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-700/15";
const labelClassName = "text-xs font-semibold uppercase tracking-wide text-ink-500";

export function ProgramCreateForm() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<ProgramRole>(ProgramRole.OPERATIONAL);
  const [state, formAction] = useFormState(createProgram, initialState);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      window.location.reload();
    }
  }, [state.ok]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800"
      >
        Create program
      </button>
    );
  }

  return (
    <section className="border border-surface-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-navy-900">Create program</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-ink-500 hover:text-ink-800">
          Cancel
        </button>
      </div>
      <form action={formAction} className="mt-4 grid gap-3">
        <AdminFormFeedback state={state} />
        <label className="grid gap-1.5">
          <span className={labelClassName}>Full name</span>
          <input name="fullName" required maxLength={180} className={inputClassName} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Setup</span>
          <select
            name="programRole"
            value={role}
            onChange={(event) => setRole(event.target.value as ProgramRole)}
            className={inputClassName}
          >
            <option value={ProgramRole.OPERATIONAL}>Program</option>
            <option value={ProgramRole.GROUP}>Organization</option>
          </select>
        </label>
        <p className="rounded-md border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-ink-700">
          {role === ProgramRole.OPERATIONAL
            ? "Programs own Teams and rosters."
            : "Organizations only group related Programs."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1.5">
            <span className={labelClassName}>Abbreviation</span>
            <input name="abbreviation" maxLength={80} className={inputClassName} placeholder="Optional" />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Type</span>
            <select name="type" defaultValue="SCHOOL" className={inputClassName}>
              <option value="SCHOOL">School</option>
              <option value="CLUB">Club</option>
              <option value="TEAM">Team</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>City</span>
            <input name="city" maxLength={100} className={inputClassName} placeholder="Optional" />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Region</span>
            <input name="region" maxLength={100} className={inputClassName} placeholder="Optional" />
          </label>
        </div>
        <AdminSaveButton label="Create program" variant="ops" className="w-fit" />
      </form>
    </section>
  );
}
