"use client";

import type { PublishImpactSummary } from "@/lib/admin-publish-impact";

export function PublishImpactSummaryCard({ summary }: { summary: PublishImpactSummary }) {
  return (
    <div className="grid gap-2 rounded-lg border border-warning-100 bg-warning-50 p-3.5 text-sm text-warning-700 md:grid-cols-2">
      <p><strong>{summary.games}</strong> games · <strong>{summary.playerStatRows}</strong> player stat rows</p>
      <p><strong>{summary.teams}</strong> teams · <strong>{summary.players}</strong> players (preview)</p>
      <p>Live PlayerRatings recompute: <strong>{summary.willRecomputeRatings ? "Yes" : "No"}</strong></p>
      <p>Public revalidation: <strong>{summary.willRevalidatePublicViews ? "Yes" : "No"}</strong></p>
      <p className="md:col-span-2 text-xs">Affected surfaces: {summary.publicSurfaces.join(", ")}</p>
    </div>
  );
}
