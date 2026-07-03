import Link from "next/link";

import type { ManagedCompetition } from "@/lib/admin/competition-management/types";

import { CompetitionCreateForm, CompetitionStatusBadge } from "./CompetitionCreateForm";

export function CompetitionListClient({ competitions }: { competitions: ManagedCompetition[] }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CompetitionCreateForm />
      </div>
      <section className="overflow-x-auto border border-surface-200 bg-white shadow-sm">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-navy-950 font-mono text-[0.65rem] font-bold uppercase tracking-[0.1em] text-white">
            <tr>
              <th className="px-4 py-2.5">Competition</th>
              <th className="px-4 py-2.5">Organization</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-center">Seasons</th>
              <th className="px-4 py-2.5 text-center">Games</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200">
            {competitions.map((competition) => (
              <tr key={competition.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/competitions/${competition.id}`}
                    prefetch={false}
                    className="font-semibold text-navy-900 hover:text-orange-700"
                  >
                    {competition.name}
                  </Link>
                  {competition.shortName ? (
                    <p className="text-xs text-ink-500">{competition.shortName}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-ink-700">{competition.organization}</td>
                <td className="px-4 py-3">
                  <CompetitionStatusBadge competition={competition} />
                </td>
                <td className="px-4 py-3 text-center text-ink-700">{competition.seasonCount}</td>
                <td className="px-4 py-3 text-center text-ink-700">{competition.gameCount}</td>
              </tr>
            ))}
            {!competitions.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-500">
                  No competitions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}
