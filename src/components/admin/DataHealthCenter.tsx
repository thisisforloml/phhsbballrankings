"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import type {
  DataHealthCenterData,
  DataHealthDiagnostic,
  DataHealthIssue,
  DataHealthSection,
  DataHealthSeverity,
} from "@/lib/admin/load-data-health-center";

function healthBand(score: number, critical: number) {
  if (critical > 0 || score < 50) return { label: "Critical", className: "text-red-700 bg-red-50 border-red-200" };
  if (score < 65) return { label: "Needs attention", className: "text-amber-800 bg-amber-50 border-amber-200" };
  if (score < 85) return { label: "Good", className: "text-sky-800 bg-sky-50 border-sky-200" };
  return { label: "Excellent", className: "text-emerald-800 bg-emerald-50 border-emerald-200" };
}

function severityLabel(severity: DataHealthSeverity) {
  if (severity === "critical") return "Critical";
  if (severity === "warning") return "Warning";
  return "Info";
}

function severityClass(severity: DataHealthSeverity) {
  if (severity === "critical") return "bg-red-100 text-red-800";
  if (severity === "warning") return "bg-amber-100 text-amber-900";
  return "bg-surface-100 text-ink-600";
}

function OverviewCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "critical" | "warning" | "info";
}) {
  const toneClass =
    tone === "critical"
      ? "border-red-200 bg-red-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : tone === "info"
          ? "border-sky-200 bg-sky-50"
          : "border-surface-200 bg-white";

  return (
    <article className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-navy-900">{value}</p>
    </article>
  );
}

function IssueRow({ issue }: { issue: DataHealthIssue }) {
  const tone =
    issue.severity === "critical" ? "critical" : issue.severity === "warning" ? "warning" : "default";

  return (
    <Link
      href={issue.href}
      prefetch={false}
      className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 transition hover:border-orange-300 ${
        tone === "critical" && issue.count > 0
          ? "border-red-200 bg-red-50/60"
          : tone === "warning" && issue.count > 0
            ? "border-amber-200 bg-amber-50/60"
            : "border-surface-200 bg-white"
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-800">{issue.label}</p>
        <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.06em] ${severityClass(issue.severity)}`}>
          {severityLabel(issue.severity)}
        </span>
      </div>
      <span className="shrink-0 font-mono text-sm font-bold text-navy-900">{issue.count.toLocaleString()}</span>
    </Link>
  );
}

function SectionPanel({ section }: { section: DataHealthSection }) {
  const activeIssues = section.issues.filter((row) => row.count > 0);
  const cleanIssues = section.issues.filter((row) => row.count === 0);

  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-navy-900">{section.title}</h2>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-surface-500">
          {activeIssues.length} active · {section.issues.length} checks
        </p>
      </div>

      {activeIssues.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {activeIssues.map((row) => (
            <IssueRow key={row.id} issue={row} />
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          No active issues in this section.
        </p>
      )}

      {cleanIssues.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.08em] text-ink-500">
            {cleanIssues.length} passing checks
          </summary>
          <ul className="mt-2 grid gap-1 text-xs text-ink-500">
            {cleanIssues.map((row) => (
              <li key={row.id}>{row.label}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function DiagnosticsPanel({ rows, auditedAt }: { rows: DataHealthDiagnostic[]; auditedAt: string }) {
  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-navy-900">Diagnostics</h2>
        <p className="text-xs text-ink-500">Workspace audit: {new Date(auditedAt).toLocaleString()}</p>
      </div>
      <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <Link
            key={row.id}
            href={row.href}
            prefetch={false}
            className="block rounded-md border border-surface-200 bg-surface-50 px-3 py-3 transition hover:border-orange-300"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold text-navy-900">{row.name}</p>
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-ink-500">
                {row.lastRunAt ? `Last signal ${new Date(row.lastRunAt).toLocaleString()}` : "No report timestamp"}
              </p>
            </div>
            <p className="mt-1 text-xs leading-5 text-ink-600">{row.description}</p>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-500">
        Read-only workspace. No fixes, recomputes, or schema changes run from this page.
      </p>
    </section>
  );
}

const SECTION_ORDER = ["players", "teams", "programs", "competitions", "ratings", "imports"] as const;

export function DataHealthCenter({ data }: { data: DataHealthCenterData }) {
  const [activeSection, setActiveSection] = useState<string>("players");

  const sectionsById = useMemo(
    () => new Map(data.sections.map((section) => [section.id, section])),
    [data.sections],
  );

  const band = healthBand(data.overview.healthScore, data.overview.critical);
  const active = sectionsById.get(activeSection) ?? data.sections[0];

  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <OverviewCard
          label="Overall health score"
          value={
            <span className="inline-flex items-center gap-2">
              {data.overview.healthScore}
              <span className={`rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-[0.06em] ${band.className}`}>
                {band.label}
              </span>
            </span>
          }
        />
        <OverviewCard label="Critical issues" value={data.overview.critical} tone="critical" />
        <OverviewCard label="Warnings" value={data.overview.warnings} tone="warning" />
        <OverviewCard label="Information" value={data.overview.information} tone="info" />
        <OverviewCard label="Last audit time" value={new Date(data.auditedAt).toLocaleString()} />
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Data health sections">
        {SECTION_ORDER.map((sectionId) => {
          const section = sectionsById.get(sectionId);
          if (!section) return null;
          const activeCount = section.issues.filter((row) => row.count > 0).length;
          const isActive = activeSection === sectionId;

          return (
            <button
              key={sectionId}
              type="button"
              onClick={() => setActiveSection(sectionId)}
              className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border-orange-300 bg-orange-50 text-navy-900"
                  : "border-surface-200 bg-white text-ink-700 hover:border-orange-200"
              }`}
            >
              {section.title}
              {activeCount > 0 ? (
                <span className="ml-2 rounded-full bg-navy-900 px-1.5 py-0.5 text-[0.65rem] font-bold text-white">
                  {activeCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {active ? <SectionPanel section={active} /> : null}

      <DiagnosticsPanel rows={data.diagnostics} auditedAt={data.auditedAt} />
    </div>
  );
}
