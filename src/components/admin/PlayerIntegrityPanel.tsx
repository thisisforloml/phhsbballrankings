"use client";

import type { ReactNode } from "react";

import type {
  IntegrityDiagnostic,
  IntegrityHealth,
  IntegritySeverity,
  PlayerIntegrityReport,
} from "@/lib/admin/build-player-integrity-report";

const labelClassName = "text-xs font-semibold uppercase tracking-wide text-ink-500";

function healthTone(health: IntegrityHealth) {
  switch (health) {
    case "Excellent":
      return "border-green-200 bg-green-50 text-green-900";
    case "Good":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "Needs Attention":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "Critical":
      return "border-red-200 bg-red-50 text-red-900";
  }
}

function severityTone(severity: IntegritySeverity) {
  switch (severity) {
    case "ERROR":
      return "border-red-200 bg-red-50 text-red-800";
    case "WARNING":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "INFO":
      return "border-surface-200 bg-surface-100 text-ink-600";
  }
}

function IntegritySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <dl className="grid gap-3 sm:grid-cols-2">{children}</dl>;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className={labelClassName}>{label}</dt>
      <dd className="text-sm text-ink-800">{value ?? "—"}</dd>
    </div>
  );
}

function DiagnosticCard({ diagnostic }: { diagnostic: IntegrityDiagnostic }) {
  return (
    <article className="rounded-md border border-surface-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink-900">{diagnostic.title}</h4>
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ${severityTone(diagnostic.severity)}`}
        >
          {diagnostic.severity}
        </span>
      </div>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-400">{diagnostic.section}</p>
      <p className="mt-2 text-sm text-ink-700">
        <span className="font-semibold text-ink-800">Why: </span>
        {diagnostic.why}
      </p>
      <p className="mt-2 text-sm text-ink-700">
        <span className="font-semibold text-ink-800">How to fix: </span>
        {diagnostic.howToFix}
      </p>
    </article>
  );
}

export function PlayerIntegrityPanel({ report }: { report: PlayerIntegrityReport }) {
  const errorCount = report.diagnostics.filter((d) => d.severity === "ERROR").length;
  const warningCount = report.diagnostics.filter((d) => d.severity === "WARNING").length;
  const infoCount = report.diagnostics.filter((d) => d.severity === "INFO").length;

  return (
    <div className="grid gap-4">
      <section className={`rounded-lg border p-4 ${healthTone(report.health)}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Overall health</p>
            <p className="mt-1 font-display text-2xl font-bold">{report.health}</p>
          </div>
          <div className="text-right text-sm">
            <p>
              Score <strong>{report.healthScore}</strong> / 100
            </p>
            <p className="mt-1 opacity-80">
              {errorCount} errors · {warningCount} warnings · {infoCount} info
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm opacity-90">
          Read-only diagnostics. No data is modified from this panel.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <IntegritySection title="Identity">
          <FieldGrid>
            <Field label="Player ID" value={<span className="font-mono text-xs">{report.identity.playerId}</span>} />
            <Field label="Slug" value={report.identity.slug} />
            <Field label="Birthdate" value={report.identity.birthDate} />
            <Field label="Age group" value={report.identity.ageGroup} />
            <Field label="Gender" value={report.identity.gender} />
            <Field label="Nationality" value={report.identity.nationality} />
            <Field label="Portrait status" value={report.identity.portraitStatus} />
            <Field label="School override" value={report.identity.schoolOverrideStatus} />
          </FieldGrid>
        </IntegritySection>

        <IntegritySection title="Program integrity">
          <FieldGrid>
            <Field label="Current program" value={report.program.currentProgram} />
            <Field label="Organization group" value={report.program.parentGroup} />
            <Field label="Current team (verified evidence)" value={report.program.currentTeam} />
            <Field label="Assignment status" value={report.program.assignmentStatus} />
          </FieldGrid>
        </IntegritySection>

        <IntegritySection title="Competition integrity">
          <FieldGrid>
            <Field label="Verified games" value={report.competition.verifiedGames} />
            <Field label="Competitions played" value={report.competition.competitionsPlayed} />
            <Field label="Latest competition" value={report.competition.latestCompetition} />
            <Field label="Latest season" value={report.competition.latestSeason} />
            <Field label="Latest verified game" value={report.competition.latestVerifiedGame} />
          </FieldGrid>
        </IntegritySection>

        <IntegritySection title="Ratings integrity">
          <FieldGrid>
            <Field label="Current rating" value={report.ratings.currentRating} />
            <Field label="Stars" value={report.ratings.stars} />
            <Field label="Snapshot count" value={report.ratings.snapshotCount} />
            <Field label="Latest snapshot" value={report.ratings.latestSnapshot} />
            <Field label="Formula version" value={report.ratings.formulaVersion} />
          </FieldGrid>
        </IntegritySection>

        <IntegritySection title="Profile integrity">
          <FieldGrid>
            <Field label="Photo" value={report.profile.photo} />
            <Field label="Bio" value={report.profile.bio} />
            <Field label="Height" value={report.profile.height} />
            <Field label="Position" value={report.profile.position} />
            <Field label="Handedness" value={report.profile.handedness} />
            <Field label="Recruiting class" value={report.profile.recruitingClass} />
            <Field label="Highlights" value={report.profile.highlights} />
          </FieldGrid>
        </IntegritySection>

        <IntegritySection title="Administrative flags">
          <FieldGrid>
            <Field label="Transfer history count" value={report.administrative.transferHistoryCount} />
            <Field label="Last transfer" value={report.administrative.lastTransfer} />
            <Field label="Last editor" value={report.administrative.lastEditor} />
            <Field label="Created" value={report.administrative.createdAt.slice(0, 10)} />
            <Field label="Updated" value={report.administrative.updatedAt.slice(0, 10)} />
            <Field label="Soft delete status" value={report.administrative.softDeleteStatus} />
          </FieldGrid>
        </IntegritySection>
      </div>

      <IntegritySection title="Diagnostics">
        {report.diagnostics.length === 0 ? (
          <p className="text-sm text-ink-600">No issues detected for this player.</p>
        ) : (
          <div className="grid gap-3">
            {report.diagnostics.map((diagnostic) => (
              <DiagnosticCard key={diagnostic.id} diagnostic={diagnostic} />
            ))}
          </div>
        )}
      </IntegritySection>
    </div>
  );
}
