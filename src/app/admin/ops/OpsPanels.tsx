"use client";

import { useFormState } from "react-dom";
import Link from "next/link";
import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";
import { recomputeAllTeamRatings, type OpsActionState } from "./actions";

const initialState: OpsActionState = { ok: false, message: "" };

export function OpsRatingsPanel() {
  const [state, action] = useFormState(recomputeAllTeamRatings, initialState);

  return (
    <section className="border border-surface-200 bg-white p-4 shadow-sm">
      <h2 className="font-display text-lg font-bold text-navy-900">Ratings ops</h2>
      <AdminFormFeedback state={state} />
      <form action={action} className="mt-3 grid gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-red-900">
          <input type="checkbox" name="confirm" required />
          Recompute all program team ratings
        </label>
        <AdminSaveButton label="Run recompute" className="w-fit" />
      </form>
      <p className="mt-2 text-xs text-ink-500">Player ratings and snapshots still run from Game Stats publish.</p>
    </section>
  );
}

export function OpsAuditLog({
  rows
}: {
  rows: Array<{
    id: string;
    entityType: string;
    action: string;
    reason: string;
    createdAt: string;
    actor: string;
  }>;
}) {
  return (
    <section className="border border-surface-200 bg-white p-4 shadow-sm">
      <h2 className="font-display text-lg font-bold text-navy-900">Audit log</h2>
      <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">
        {rows.map((row) => (
          <article key={row.id} className="border border-surface-100 bg-surface-50 p-3 text-sm">
            <p className="font-semibold text-navy-900">{row.entityType} · {row.action}</p>
            <p className="text-ink-600">{row.reason}</p>
            <p className="text-xs text-ink-500">{row.actor} · {row.createdAt}</p>
          </article>
        ))}
        {!rows.length ? <p className="text-sm text-ink-500">No audit entries yet.</p> : null}
      </div>
    </section>
  );
}

export function OpsToolsLinks() {
  const links = [
    { href: "/admin/data-health", label: "Data health" },
    { href: "/admin/data-health/player-duplicates", label: "Duplicate players" },
    { href: "/administrator", label: "Legacy organizer applications" }
  ] as const;

  return (
    <section className="border border-surface-200 bg-white p-4 shadow-sm">
      <h2 className="font-display text-lg font-bold text-navy-900">Tools</h2>
      <ul className="mt-3 divide-y divide-surface-100">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="block py-3 font-semibold text-navy-900 hover:text-orange-700">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
