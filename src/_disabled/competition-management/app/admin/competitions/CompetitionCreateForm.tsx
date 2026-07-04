"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";

import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";
import type { ManagedCompetition } from "@/lib/admin/competition-management/types";

import { type CompetitionActionState,createCompetition } from "./actions";

const initialState: CompetitionActionState = { ok: false, message: "" };
const inputClassName =
  "min-h-10 w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm";
const labelClassName = "text-xs font-semibold uppercase tracking-wide text-ink-500";

export function CompetitionCreateForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createCompetition, initialState);

  useEffect(() => {
    if (state.ok) window.location.reload();
  }, [state.ok]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800"
      >
        Create competition
      </button>
    );
  }

  return (
    <section className="border border-surface-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-navy-900">Create competition</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-ink-500">
          Cancel
        </button>
      </div>
      <form action={formAction} className="mt-4 grid gap-3 lg:grid-cols-2">
        <AdminFormFeedback state={state} />
        <label className="grid gap-1.5 lg:col-span-2">
          <span className={labelClassName}>Name</span>
          <input name="name" required maxLength={160} className={inputClassName} placeholder="UAAP" />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Short name</span>
          <input name="shortName" maxLength={40} className={inputClassName} placeholder="UAAP" />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Organization</span>
          <input name="organization" required maxLength={160} className={inputClassName} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Season type</span>
          <select name="seasonType" className={inputClassName} defaultValue="ACADEMIC">
            <option value="ACADEMIC">Academic</option>
            <option value="CALENDAR">Calendar</option>
            <option value="TOURNAMENT">Tournament</option>
            <option value="YEAR_ROUND">Year round</option>
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Status</span>
          <select name="status" className={inputClassName} defaultValue="ACTIVE">
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Country</span>
          <input name="country" defaultValue="Philippines" maxLength={80} className={inputClassName} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Region</span>
          <input name="region" maxLength={100} className={inputClassName} placeholder="NCR" />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Sport</span>
          <select name="sport" className={inputClassName} defaultValue="BASKETBALL">
            <option value="BASKETBALL">Basketball</option>
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className={labelClassName}>Tier</span>
          <input name="tier" type="number" min={1} max={4} defaultValue={2} required className={inputClassName} />
        </label>
        <fieldset className="grid gap-2 lg:col-span-2">
          <legend className={labelClassName}>Default age groups</legend>
          {["U13", "U16", "U19"].map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="defaultAgeGroups" value={value} defaultChecked={value === "U19"} />
              {value}
            </label>
          ))}
        </fieldset>
        <fieldset className="grid gap-2 lg:col-span-2">
          <legend className={labelClassName}>Default genders</legend>
          {["BOYS", "GIRLS"].map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="defaultGenders" value={value} defaultChecked />
              {value}
            </label>
          ))}
        </fieldset>
        <label className="grid gap-1.5 lg:col-span-2">
          <span className={labelClassName}>Logo URL</span>
          <input name="logoUrl" maxLength={500} className={inputClassName} />
        </label>
        <label className="grid gap-1.5 lg:col-span-2">
          <span className={labelClassName}>Website</span>
          <input name="website" maxLength={500} className={inputClassName} />
        </label>
        <label className="grid gap-1.5 lg:col-span-2">
          <span className={labelClassName}>Notes</span>
          <textarea name="notes" maxLength={2000} rows={3} className={inputClassName} />
        </label>
        <AdminSaveButton label="Create competition" className="w-fit lg:col-span-2" />
      </form>
    </section>
  );
}

export function CompetitionStatusBadge({ competition }: { competition: Pick<ManagedCompetition, "status"> }) {
  const tone =
    competition.status === "ACTIVE"
      ? "bg-green-50 text-green-800"
      : competition.status === "INACTIVE"
        ? "bg-amber-50 text-amber-800"
        : "bg-surface-100 text-ink-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{competition.status}</span>;
}
