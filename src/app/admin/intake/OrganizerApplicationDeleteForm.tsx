"use client";

import { useState } from "react";
import { useFormState } from "react-dom";

import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";

import { deleteOrganizerApplication, type IntakeActionState } from "./actions";

const initialState: IntakeActionState = { ok: false, message: "" };

type OrganizerApplicationDeleteFormProps = {
  applicationId: string;
  applicantName: string;
  status: string;
};

export function OrganizerApplicationDeleteForm({
  applicationId,
  applicantName,
  status,
}: OrganizerApplicationDeleteFormProps) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [state, action] = useFormState(deleteOrganizerApplication, initialState);
  const canDelete = confirmText === "DELETE";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-red-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-red-800 hover:bg-red-50"
      >
        Remove
      </button>
    );
  }

  return (
    <div className="mt-4 border border-red-200 bg-red-50/60 p-3">
      <AdminFormFeedback state={state} />
      <form action={action} className="grid gap-3">
        <input type="hidden" name="applicationId" value={applicationId} />
        <div className="text-sm text-red-900">
          <p>
            This soft-deletes <strong className="font-semibold text-red-950">{applicantName}</strong> ({status}). The
            application record and audit history are preserved but hidden from intake queues.
          </p>
          <p className="mt-1 text-red-800">Type DELETE to confirm.</p>
        </div>
        <label className="grid gap-1.5 text-xs font-semibold text-red-950">
          Confirmation
          <input
            name="confirmText"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            autoComplete="off"
            className="min-h-10 border border-red-300 bg-white px-3 py-2 font-mono text-sm text-ink-900 outline-none focus:border-red-500"
            placeholder="DELETE"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={!canDelete}
            className="bg-red-700 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            Delete Application
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
