"use client";

import Link from "next/link";
import { useFormState } from "react-dom";

import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";

import {
  type IntakeActionState,
  reviewOrganizerApplication,
  reviewPlayerProfileSubmission,
} from "./actions";

const initialState: IntakeActionState = { ok: false, message: "" };

export type PlayerSubmissionRow = {
  id: string;
  status: string;
  firstName: string;
  lastName: string;
  position: string | null;
  heightCm: number | null;
  city: string | null;
  region: string | null;
  contact: string;
  message: string | null;
  playerId: string | null;
  createdAt: string;
};

export type OrganizerApplicationRow = {
  id: string;
  status: string;
  applicantName: string;
  organization: string;
  leagueName: string;
  city: string;
  region: string;
  contact: string;
  experienceNotes: string | null;
  createdAt: string;
};

function isPending(status: string) {
  return status === "PENDING";
}

export function IntakeReviewClient({
  playerSubmissions,
  organizerApplications,
}: {
  playerSubmissions: PlayerSubmissionRow[];
  organizerApplications: OrganizerApplicationRow[];
}) {
  const [playerState, playerAction] = useFormState(reviewPlayerProfileSubmission, initialState);
  const [organizerState, organizerAction] = useFormState(reviewOrganizerApplication, initialState);

  const pendingPlayers = playerSubmissions.filter((row) => isPending(row.status));
  const pendingOrganizers = organizerApplications.filter((row) => isPending(row.status));

  return (
    <div className="grid gap-6">
      <AdminFormFeedback state={playerState} />
      <AdminFormFeedback state={organizerState} />

      <section className="border border-surface-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold text-navy-900">Organizer applications</h2>
          <p className="text-sm text-ink-500">{pendingOrganizers.length} pending · {organizerApplications.length} shown</p>
        </div>
        <div className="mt-4 grid gap-4">
          {organizerApplications.map((row) => (
            <article key={row.id} className="border border-surface-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-navy-900">{row.applicantName}</h3>
                  <p className="text-sm text-ink-600">
                    {row.organization} · {row.leagueName}
                  </p>
                  <p className="text-sm text-ink-500">
                    {row.city}, {row.region} · {row.contact}
                  </p>
                  {row.experienceNotes ? <p className="mt-2 text-sm text-ink-700">{row.experienceNotes}</p> : null}
                  <p className="mt-1 text-xs text-ink-500">Submitted {row.createdAt}</p>
                </div>
                <span className="rounded bg-surface-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink-600">
                  {row.status}
                </span>
              </div>
              {isPending(row.status) ? (
                <form action={organizerAction} className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                  <input type="hidden" name="applicationId" value={row.id} />
                  <input name="adminNotes" placeholder="Admin notes (optional)" className="min-h-10 border border-surface-200 px-3" />
                  <button type="submit" name="action" value="APPROVE" className="bg-navy-900 px-4 py-2 text-sm font-semibold text-white">
                    Approve
                  </button>
                  <button type="submit" name="action" value="REJECT" className="border border-red-300 px-4 py-2 text-sm font-semibold text-red-800">
                    Reject
                  </button>
                </form>
              ) : null}
            </article>
          ))}
          {!organizerApplications.length ? <p className="text-sm text-ink-500">No organizer applications yet.</p> : null}
        </div>
      </section>

      <section className="border border-surface-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold text-navy-900">Player profile submissions</h2>
          <p className="text-sm text-ink-500">{pendingPlayers.length} pending · {playerSubmissions.length} shown</p>
        </div>
        <div className="mt-4 grid gap-4">
          {playerSubmissions.map((row) => (
            <article key={row.id} className="border border-surface-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-navy-900">
                    {row.firstName} {row.lastName}
                  </h3>
                  <p className="text-sm text-ink-600">
                    {row.position ?? "Position not listed"}
                    {row.heightCm ? ` · ${row.heightCm} cm` : ""}
                  </p>
                  <p className="text-sm text-ink-500">
                    {row.city ?? "—"}, {row.region ?? "—"} · {row.contact}
                  </p>
                  {row.message ? <p className="mt-2 text-sm text-ink-700">{row.message}</p> : null}
                  <p className="mt-1 text-xs text-ink-500">
                    Submitted {row.createdAt}
                    {row.playerId ? " · linked to existing player" : " · new player on approval"}
                  </p>
                </div>
                <span className="rounded bg-surface-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink-600">
                  {row.status}
                </span>
              </div>
              {isPending(row.status) ? (
                <form action={playerAction} className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                  <input type="hidden" name="submissionId" value={row.id} />
                  <input name="adminNotes" placeholder="Admin notes (optional)" className="min-h-10 border border-surface-200 px-3" />
                  <button type="submit" name="action" value="APPROVE" className="bg-navy-900 px-4 py-2 text-sm font-semibold text-white">
                    Approve
                  </button>
                  <button type="submit" name="action" value="REJECT" className="border border-red-300 px-4 py-2 text-sm font-semibold text-red-800">
                    Reject
                  </button>
                </form>
              ) : null}
            </article>
          ))}
          {!playerSubmissions.length ? <p className="text-sm text-ink-500">No player profile submissions yet.</p> : null}
        </div>
      </section>

      <p className="text-sm text-ink-500">
        Profile ownership claims are reviewed separately on{" "}
        <Link href="/admin/claims" prefetch={false} className="font-semibold text-orange-700">
          Profile Claims
        </Link>
        .
      </p>
    </div>
  );
}
