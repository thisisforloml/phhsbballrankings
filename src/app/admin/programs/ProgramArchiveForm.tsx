"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";

import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";

import { archiveProgram, type ProgramActionState } from "./actions";

const initialState: ProgramActionState = { ok: false, message: "" };

export function ProgramArchiveForm({ programId, programName }: { programId: string; programName: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [state, formAction] = useFormState(archiveProgram, initialState);
  const canArchive = confirmText === "ARCHIVE";

  useEffect(() => {
    if (state.ok) {
      window.location.href = "/admin/programs";
    }
  }, [state.ok]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-red-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-red-800 hover:bg-red-50"
      >
        Archive program
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50/60 p-4">
      <form action={formAction} className="grid gap-3">
        <input type="hidden" name="programId" value={programId} />
        <AdminFormFeedback state={state} />
        <p className="text-sm text-red-900">
          Archives <strong>{programName}</strong>. Team links and historical records are preserved. The program is hidden from active admin lists.
        </p>
        <label className="grid gap-1.5 text-xs font-semibold text-red-950">
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
            disabled={!canArchive}
            className="bg-red-700 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:bg-red-300"
          >
            Archive program
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setConfirmText("");
            }}
            className="border border-surface-300 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-ink-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
