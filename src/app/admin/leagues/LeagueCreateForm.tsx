"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";

import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";

import { createLeagueCompetition, type LeagueActionState } from "./actions";

const initialState: LeagueActionState = { ok: false, message: "" };
const inputClassName = "min-h-10 w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-700/15";
const labelClassName = "text-xs font-semibold uppercase tracking-wide text-ink-500";

export function LeagueCreateForm() {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(createLeagueCompetition, initialState);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    if (state.ok) window.location.reload();
  }, [state.ok]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-fit bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">
        Create league competition
      </button>
    );
  }

  return (
    <section className="border border-surface-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-navy-900">Create league competition</h2>
          <p className="mt-1 text-sm text-ink-600">Creates one League bracket and its first Season.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-semibold text-ink-500">Cancel</button>
      </div>
      <form action={action} className="mt-4 grid gap-3">
        <AdminFormFeedback state={state} />
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1.5 md:col-span-2">
            <span className={labelClassName}>League / organizer</span>
            <input name="familyName" required maxLength={160} className={inputClassName} placeholder="Philippine Youth Basketball Championship" />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Bracket</span>
            <select name="bracketLabel" defaultValue="U19 BOYS" className={inputClassName}>
              <option>U13 BOYS</option>
              <option>U13 GIRLS</option>
              <option>U15 BOYS</option>
              <option>U15 GIRLS</option>
              <option>U16 BOYS</option>
              <option>U16 GIRLS</option>
              <option>U17 BOYS</option>
              <option>U17 GIRLS</option>
              <option>U18 BOYS</option>
              <option>U18 GIRLS</option>
              <option>U19 BOYS</option>
              <option>U19 GIRLS</option>
            </select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5">
            <span className={labelClassName}>Season</span>
            <input name="seasonName" required maxLength={120} className={inputClassName} placeholder="Season 1" />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Year</span>
            <input name="seasonYear" type="number" min="2000" max="2100" defaultValue={currentYear} required className={inputClassName} />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Starts</span>
            <input name="startsOn" type="date" required className={inputClassName} />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Ends</span>
            <input name="endsOn" type="date" className={inputClassName} />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1.5">
            <span className={labelClassName}>City</span>
            <input name="city" maxLength={100} className={inputClassName} />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Region</span>
            <input name="region" maxLength={100} className={inputClassName} />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClassName}>Tier</span>
            <input name="tier" type="number" min="1" max="4" defaultValue="1" required className={inputClassName} />
          </label>
        </div>
        <AdminSaveButton label="Create competition" className="w-fit" />
      </form>
    </section>
  );
}