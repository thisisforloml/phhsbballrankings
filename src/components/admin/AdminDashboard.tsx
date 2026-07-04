import Link from "next/link";
import type { ReactNode } from "react";

import type {
  AdminDashboardAttention,
  AdminDashboardData,
  AdminDashboardRecentAction,
  AdminDashboardRecentGame,
  AdminDashboardRecentImport,
  AdminDashboardSummary,
} from "@/lib/admin/load-admin-dashboard";

function SummaryCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm transition hover:border-orange-300 hover:shadow-md"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-navy-900">{value.toLocaleString()}</p>
    </Link>
  );
}

function AttentionRow({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  href: string;
  tone?: "default" | "warning" | "critical";
}) {
  const toneClass =
    tone === "critical"
      ? value > 0
        ? "border-red-200 bg-red-50"
        : "border-surface-200 bg-white"
      : tone === "warning"
        ? value > 0
          ? "border-amber-200 bg-amber-50"
          : "border-surface-200 bg-white"
        : "border-surface-200 bg-white";

  return (
    <Link
      href={href}
      prefetch={false}
      className={`flex items-center justify-between rounded-md border px-3 py-2.5 transition hover:border-orange-300 ${toneClass}`}
    >
      <span className="text-sm font-medium text-ink-800">{label}</span>
      <span className="font-mono text-sm font-bold text-navy-900">{value.toLocaleString()}</span>
    </Link>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <h2 className="font-display text-lg font-bold text-navy-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function AdminDashboard({ data }: { data: AdminDashboardData }) {
  return (
    <div className="grid gap-5">
      <SummaryGrid summary={data.summary} />
      <div className="grid gap-4 lg:grid-cols-2">
        <AttentionPanel attention={data.attention} />
        <RecentImports rows={data.recentImports} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentActions rows={data.recentActions} />
        <RecentGames rows={data.recentPublishedGames} />
      </div>
    </div>
  );
}

function SummaryGrid({ summary }: { summary: AdminDashboardSummary }) {
  const cards = [
    { label: "Players", value: summary.players, href: "/admin/players" },
    { label: "Teams", value: summary.teams, href: "/admin/teams" },
    { label: "Programs", value: summary.programs, href: "/admin/programs" },
    { label: "Leagues", value: summary.competitions, href: "/admin/leagues" },
    { label: "Seasons", value: summary.seasons, href: "/admin/leagues" },
    { label: "Games", value: summary.games, href: "/admin/submissions" },
    { label: "Verified games", value: summary.verifiedGames, href: "/admin/leagues" },
    { label: "Ratings", value: summary.ratings, href: "/admin/team-ratings" },
    { label: "Imports", value: summary.imports, href: "/admin/submissions" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {cards.map((card) => (
        <SummaryCard key={card.label} {...card} />
      ))}
    </section>
  );
}

function AttentionPanel({ attention }: { attention: AdminDashboardAttention }) {
  return (
    <Panel title="Needs attention">
      <div className="grid gap-2">
        <AttentionRow label="Pending imports" value={attention.pendingImports} href="/admin/submissions" tone="warning" />
        <AttentionRow
          label="Duplicate candidates"
          value={attention.duplicateCandidates}
          href="/admin/data-health/player-duplicates"
          tone="warning"
        />
        <AttentionRow label="Integrity warnings" value={attention.integrityWarnings} href="/admin/players" tone="warning" />
        <AttentionRow
          label="Players without programs"
          value={attention.playersWithoutPrograms}
          href="/admin/players?program=Program%20pending"
        />
        <AttentionRow label="Teams without programs" value={attention.teamsWithoutPrograms} href="/admin/teams" />
        <AttentionRow label="Programs without teams" value={attention.programsWithoutTeams} href="/admin/programs" />
        <AttentionRow
          label="Archived entities needing review"
          value={attention.archivedNeedingReview}
          href="/admin/ops"
          tone="critical"
        />
      </div>
      <p className="mt-3 text-xs text-ink-500">Read-only signals. Follow links to review in the relevant admin module.</p>
    </Panel>
  );
}

function RecentImports({ rows }: { rows: AdminDashboardRecentImport[] }) {
  return (
    <Panel title="Last imports">
      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={row.href} prefetch={false} className="block rounded-md border border-surface-200 px-3 py-2 hover:border-orange-300">
                <p className="font-semibold text-ink-900">{row.title}</p>
                <p className="text-xs text-ink-500">
                  {row.status.replaceAll("_", " ")} · {row.createdAt.slice(0, 10)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-500">No imports yet.</p>
      )}
      <Link href="/admin/submissions" prefetch={false} className="mt-3 inline-block text-sm font-semibold text-orange-700">
        Open Game Stats
      </Link>
    </Panel>
  );
}

function RecentActions({ rows }: { rows: AdminDashboardRecentAction[] }) {
  return (
    <Panel title="Last admin actions">
      {rows.length ? (
        <ul className="space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.id} className="rounded-md border border-surface-200 px-3 py-2">
              <p className="font-semibold text-ink-900">
                {row.action} · {row.entityType}
              </p>
              <p className="text-xs text-ink-500">
                {row.actor} · {row.createdAt.slice(0, 16).replace("T", " ")}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-500">No audit log entries yet.</p>
      )}
      <Link href="/admin/ops" prefetch={false} className="mt-3 inline-block text-sm font-semibold text-orange-700">
        View full audit log
      </Link>
    </Panel>
  );
}

function RecentGames({ rows }: { rows: AdminDashboardRecentGame[] }) {
  return (
    <Panel title="Latest published games">
      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={row.href} prefetch={false} className="block rounded-md border border-surface-200 px-3 py-2 hover:border-orange-300">
                <p className="font-semibold text-ink-900">{row.label}</p>
                <p className="text-xs text-ink-500">
                  {row.verificationStatus} · {row.gameDate}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-500">No verified games yet.</p>
      )}
      <Link href="/admin/submissions" prefetch={false} className="mt-3 inline-block text-sm font-semibold text-orange-700">
        Game Stats queue
      </Link>
    </Panel>
  );
}
