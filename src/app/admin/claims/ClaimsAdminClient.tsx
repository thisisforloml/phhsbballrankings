"use client";

import Link from "next/link";
import { useFormState } from "react-dom";

import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";

import { type ClaimActionState, reviewProfileClaim } from "./actions";

const initialState: ClaimActionState = { ok: false, message: "" };

export type ClaimRow = {
  id: string;
  playerId: string;
  status: string;
  claimantName: string;
  relationship: string;
  contactEmail: string | null;
  contactPhone: string | null;
  message: string | null;
  createdAt: string;
  playerName: string;
  playerHref: string;
};

export function ClaimsAdminClient({ pending, approved }: { pending: ClaimRow[]; approved: ClaimRow[] }) {
  const [state, action] = useFormState(reviewProfileClaim, initialState);

  return (
    <div className="grid gap-6">
      <AdminFormFeedback state={state} />
      <section className="border border-surface-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-xl font-bold text-navy-900">Pending ({pending.length})</h2>
        <div className="mt-4 grid gap-4">
          {pending.map((claim) => (
            <article key={claim.id} className="border border-surface-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-navy-900">{claim.playerName}</h3>
                  <p className="text-sm text-ink-600">{claim.claimantName} · {claim.relationship}</p>
                  <p className="text-sm text-ink-500">{claim.contactEmail ?? claim.contactPhone ?? "No contact"}</p>
                  {claim.message ? <p className="mt-2 text-sm text-ink-700">{claim.message}</p> : null}
                </div>
                <Link href={claim.playerHref} prefetch={false} className="text-sm font-semibold text-orange-700">View profile</Link>
              </div>
              <form action={action} className="mt-4 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                <input type="hidden" name="claimId" value={claim.id} />
                <input name="adminNotes" placeholder="Admin notes (optional)" className="min-h-10 border border-surface-200 px-3" />
                <button type="submit" name="action" value="APPROVE" className="bg-navy-900 px-4 py-2 text-sm font-semibold text-white">Approve</button>
                <button type="submit" name="action" value="REJECT" className="border border-red-300 px-4 py-2 text-sm font-semibold text-red-800">Reject</button>
              </form>
            </article>
          ))}
          {!pending.length ? <p className="text-sm text-ink-500">No pending claims.</p> : null}
        </div>
      </section>

      <section className="border border-surface-200 bg-white p-4 shadow-sm">
        <h2 className="font-display text-xl font-bold text-navy-900">Approved ({approved.length})</h2>
        <ul className="mt-3 divide-y divide-surface-100">
          {approved.map((claim) => (
            <li key={claim.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <p className="font-semibold text-navy-900">{claim.playerName}</p>
                <p className="text-sm text-ink-600">{claim.claimantName} · {claim.createdAt}</p>
              </div>
              <Link href={`/portal/my-profile?playerId=${claim.playerId}`} prefetch={false} className="text-sm font-semibold text-orange-700">Monitoring</Link>
            </li>
          ))}
          {!approved.length ? <li className="py-3 text-sm text-ink-500">No approved claims yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
