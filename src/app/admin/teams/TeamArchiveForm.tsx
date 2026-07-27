"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";

import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";

import { archiveTeam, type UpdateTeamState } from "./actions";

const initialState: UpdateTeamState = { ok: false, message: "" };

export function TeamArchiveForm({ teamId, teamName }: { teamId: string; teamName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [state, formAction] = useFormState(archiveTeam, initialState);

  useEffect(() => {
    if (state.ok) window.location.href = "/admin/teams";
  }, [state.ok]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50"
      >
        Archive team
      </button>
    );
  }

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border border-red-200 bg-red-50/60 p-4">
      <input type="hidden" name="teamId" value={teamId} />
      <AdminFormFeedback state={state} />
      <p className="text-sm text-red-950">
        Archive <strong>{teamName}</strong>? This is allowed only when it has no games, stat rows,
        roster assignments, import aliases, or ratings.
      </p>
      <label className="grid max-w-sm gap-1.5 text-xs font-semibold text-red-950">
        Type ARCHIVE to confirm
        <input
          name="confirmText"
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          autoComplete="off"
          className="min-h-10 border border-red-300 bg-white px-3 py-2 font-mono text-sm text-ink-900"
          placeholder="ARCHIVE"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={confirmText !== "ARCHIVE"}
          className="bg-red-700 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-red-300"
        >
          Archive team
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirmText("");
          }}
          className="border border-surface-300 px-4 py-2 text-xs font-semibold text-ink-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}