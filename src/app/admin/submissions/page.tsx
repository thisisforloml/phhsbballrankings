import Link from "next/link";
import { AdminAlert } from "@/components/admin/AdminAlert";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminFilterChipBar } from "@/components/admin/AdminFilterChipBar";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { resolveSubmissionHubTab } from "@/lib/admin/submission-hub-tabs";
import { SubmissionsHubTabs } from "@/components/admin/SubmissionsHubTabs";
import { ReadinessBadge, SubmissionStatusBadge } from "@/components/admin/submissionStatusBadges";
import { displaySubmissionStatus, submissionReadinessBadgeClass, submissionStatusBadge } from "@/components/admin/submissionStatus";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { buildSubmissionReview, type SubmissionReview } from "@/lib/submission-review";
import { activeSubmissionWhere, canDeleteDraftSubmission } from "@/lib/submission-lifecycle";
import type { Submission, SubmissionStatus, User } from "@prisma/client";
import { SubmissionFileIntakePanel, SubmissionJsonIntakePanel, SubmissionUrlIntakePanel } from "./SubmissionIntakePanels";
import { SubmissionManualTab } from "./SubmissionManualTab";
import { SubmissionRowMenu } from "./SubmissionRowMenu";

export const metadata = {
  title: "Game Stats | Admin",
  description: "Submit, review, and publish game statistics."
};

const QUEUE_LIMIT = 100;

const PRESET_FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "under_review", label: "Under Review" },
  { key: "approved", label: "Approved" },
  { key: "ready_to_publish", label: "Ready to Publish" },
  { key: "imported", label: "Imported" }
] as const;

type PresetKey = (typeof PRESET_FILTERS)[number]["key"];

type SubmissionRow = Submission & {
  submittedBy: Pick<User, "id" | "name" | "username" | "email" | "role">;
};

type PageProps = {
  searchParams?: {
    tab?: string;
    jsonCreated?: string;
    jsonError?: string;
    created?: string;
    error?: string;
    draftDeleted?: string;
    status?: string;
    search?: string;
    preset?: string;
  };
};

function displayStatusLabel(status: string) {
  return displaySubmissionStatus(status);
}

function statusBadgeClass(status: string) {
  return submissionStatusBadge(status);
}

function readinessBadgeClass(importReady: boolean, status: string) {
  return submissionReadinessBadgeClass(importReady, status);
}

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "-";
}

function nextAction(status: string, importReady: boolean) {
  if (status === "DRAFT") return "Review";
  if (status === "IMPORTED") return "View";
  if (status === "APPROVED" && importReady) return "Publish";
  if (status === "APPROVED") return "Fix issues";
  if (status === "REJECTED") return "Reopen";
  return "Review";
}

function displayReadinessLabel(review: SubmissionReview, status: string) {
  if (status === "APPROVED" && review.importReady) return "Ready to publish";
  if (status === "IMPORTED") return "Imported";
  const normalized = review.readinessLabel.toUpperCase();
  if (normalized.includes("READY")) return "Parser ready";
  return "Needs fixes";
}

function queueHref(params: { preset?: string; search?: string; status?: string }) {
  const query = new URLSearchParams();
  if (params.preset && params.preset !== "all") query.set("preset", params.preset);
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.status && params.status !== "All") query.set("status", params.status);
  const value = query.toString();
  return value ? `/admin/submissions?${value}` : "/admin/submissions";
}

function resolvePreset(searchParams: PageProps["searchParams"]): PresetKey {
  const preset = searchParams?.preset;
  if (preset && PRESET_FILTERS.some((item) => item.key === preset)) {
    return preset as PresetKey;
  }
  const legacyStatus = searchParams?.status;
  if (legacyStatus === "SUBMITTED" || legacyStatus === "UNDER_REVIEW" || legacyStatus === "APPROVED" || legacyStatus === "IMPORTED" || legacyStatus === "REJECTED") {
    if (legacyStatus === "UNDER_REVIEW") return "under_review";
    if (legacyStatus === "APPROVED") return "approved";
    if (legacyStatus === "IMPORTED") return "imported";
    if (legacyStatus === "SUBMITTED") return "open";
  }
  return "all";
}

function matchesPreset(submission: SubmissionRow, review: SubmissionReview, preset: PresetKey) {
  switch (preset) {
    case "open":
      return submission.status === "SUBMITTED" || submission.status === "UNDER_REVIEW" || submission.status === "APPROVED";
    case "under_review":
      return submission.status === "UNDER_REVIEW";
    case "approved":
      return submission.status === "APPROVED";
    case "ready_to_publish":
      return submission.status === "APPROVED" && review.importReady;
    case "imported":
      return submission.status === "IMPORTED";
    default:
      return true;
  }
}

function matchesLegacyStatus(submission: SubmissionRow, selectedStatus: string) {
  if (selectedStatus === "All") return true;
  return submission.status === selectedStatus;
}

function priorityScore(submission: SubmissionRow, review: SubmissionReview) {
  if (submission.status === "APPROVED" && review.importReady) return 1;
  if (submission.status === "UNDER_REVIEW" && review.importReady) return 2;
  if (submission.status === "SUBMITTED" && review.importReady) return 3;
  if (submission.status === "SUBMITTED") return 4;
  if (submission.status === "UNDER_REVIEW") return 5;
  if (submission.status === "APPROVED") return 6;
  if (submission.status === "REJECTED") return 7;
  return 8;
}

function sortForTriage(left: { submission: SubmissionRow; review: SubmissionReview }, right: { submission: SubmissionRow; review: SubmissionReview }) {
  const priorityDelta = priorityScore(left.submission, left.review) - priorityScore(right.submission, right.review);
  if (priorityDelta !== 0) return priorityDelta;
  return right.submission.updatedAt.getTime() - left.submission.updatedAt.getTime();
}

function actionButtonClass(action: string) {
  if (action === "Publish") return "whitespace-nowrap bg-orange-600 px-3 py-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em] text-white hover:bg-orange-700";
  if (action === "Review") return "whitespace-nowrap bg-navy-900 px-3 py-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em] text-white hover:bg-orange-600";
  return "whitespace-nowrap border border-surface-300 px-3 py-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-700 hover:border-orange-400 hover:text-orange-700";
}

export default async function AdminSubmissionsPage({ searchParams }: PageProps) {
  await requireAdminUser();

  const activeTab = resolveSubmissionHubTab(searchParams?.tab);
  const tabPreserve = {
    preset: searchParams?.preset,
    search: searchParams?.search,
    status: searchParams?.status
  };

  if (activeTab === "json") {
    return (
      <>
        <AdminPageHeader title="Game Stats" />
        <SubmissionsHubTabs active={activeTab} preserve={tabPreserve} />
        <SubmissionJsonIntakePanel jsonCreated={searchParams?.jsonCreated} jsonError={searchParams?.jsonError} />
      </>
    );
  }

  if (activeTab === "file") {
    return (
      <>
        <AdminPageHeader title="Game Stats" />
        <SubmissionsHubTabs active={activeTab} preserve={tabPreserve} />
        <SubmissionFileIntakePanel created={searchParams?.created} error={searchParams?.error} />
      </>
    );
  }

  if (activeTab === "url") {
    return (
      <>
        <AdminPageHeader title="Game Stats" />
        <SubmissionsHubTabs active={activeTab} preserve={tabPreserve} />
        <SubmissionUrlIntakePanel />
      </>
    );
  }

  if (activeTab === "manual") {
    return (
      <>
        <AdminPageHeader title="Game Stats" />
        <SubmissionsHubTabs active={activeTab} preserve={tabPreserve} />
        <SubmissionManualTab errorMessage={searchParams?.error ? decodeURIComponent(searchParams.error) : undefined} />
      </>
    );
  }

  const [submissions, totalSubmissionCount] = await Promise.all([
    prisma.submission.findMany({
      where: activeSubmissionWhere,
      include: {
        submittedBy: {
          select: { id: true, name: true, username: true, email: true, role: true }
        }
      },
      orderBy: { createdAt: "desc" },
      take: QUEUE_LIMIT
    }),
    prisma.submission.count({ where: activeSubmissionWhere })
  ]);

  const enriched = submissions.map((submission) => ({
    submission,
    review: buildSubmissionReview(submission)
  }));

  const selectedPreset = resolvePreset(searchParams);
  const search = searchParams?.search?.trim().toLowerCase() ?? "";
  const legacyStatus = searchParams?.status ?? "All";

  const visibleRows = enriched
    .filter(({ submission, review }) => {
      if (!matchesPreset(submission, review, selectedPreset)) return false;
      if (!matchesLegacyStatus(submission, legacyStatus)) return false;
      if (!search) return true;
      return [submission.title, submission.leagueName, submission.submittedBy.name, submission.submittedBy.username, submission.submittedBy.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    })
    .sort(sortForTriage);

  const priorityRows = enriched
    .filter(({ submission }) => submission.status === "SUBMITTED" || submission.status === "UNDER_REVIEW" || (submission.status === "APPROVED"))
    .sort(sortForTriage)
    .slice(0, 5);

  const statusCounts = enriched.reduce<Record<string, number>>((counts, { submission }) => {
    counts[submission.status] = (counts[submission.status] ?? 0) + 1;
    return counts;
  }, {});

  const presetCounts = {
    open: enriched.filter(({ submission }) => submission.status === "SUBMITTED" || submission.status === "UNDER_REVIEW" || submission.status === "APPROVED").length,
    under_review: statusCounts.UNDER_REVIEW ?? 0,
    approved: statusCounts.APPROVED ?? 0,
    ready_to_publish: enriched.filter(({ submission, review }) => submission.status === "APPROVED" && review.importReady).length,
    imported: statusCounts.IMPORTED ?? 0
  };

  const statuses = Object.keys(statusCounts).sort() as SubmissionStatus[];

  const presetChipItems = PRESET_FILTERS.map((item) => ({
    key: item.key,
    label: item.label,
    count:
      item.key === "all"
        ? submissions.length
        : item.key === "open"
          ? presetCounts.open
          : item.key === "under_review"
            ? presetCounts.under_review
            : item.key === "approved"
              ? presetCounts.approved
              : item.key === "ready_to_publish"
                ? presetCounts.ready_to_publish
                : presetCounts.imported,
    href: queueHref({ preset: item.key, search: searchParams?.search })
  }));

  return (
    <>
          <AdminPageHeader title="Game Stats">
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <SubmissionStatusBadge key={status} status={status} count={count} />
              ))}
            </div>
          </AdminPageHeader>

          <SubmissionsHubTabs active="review" preserve={tabPreserve} />

          {totalSubmissionCount > QUEUE_LIMIT ? (
            <AdminAlert variant="warning" size="md" className="px-4 py-3">
              Showing latest {QUEUE_LIMIT} of {totalSubmissionCount.toLocaleString()}.
            </AdminAlert>
          ) : null}

          {searchParams?.draftDeleted ? (
            <AdminAlert variant="success" size="md" className="px-4 py-3">
              Submission deleted. The record is preserved for audit but hidden from review queues.
            </AdminAlert>
          ) : null}
          {searchParams?.jsonCreated ? (
            <AdminAlert variant="success" size="md" className="px-4 py-3">
              Valid JSON submission created for admin review.
            </AdminAlert>
          ) : null}
          {searchParams?.jsonError ? (
            <AdminAlert variant="error" size="md" className="px-4 py-3">
              {decodeURIComponent(searchParams.jsonError)}
            </AdminAlert>
          ) : null}

          {priorityRows.length ? (
            <section className="border border-orange-200 bg-orange-50/60 p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-black text-navy-900">Review next</h2>
                  <p className="text-xs font-semibold text-ink-600">Highest-priority open work from the latest {QUEUE_LIMIT} records.</p>
                </div>
                <Link href={queueHref({ preset: "open", search: searchParams?.search })} className="text-xs font-black uppercase tracking-[0.08em] text-orange-800 hover:text-orange-900">
                  View all open
                </Link>
              </div>
              <div className="mt-3 grid gap-2">
                {priorityRows.map(({ submission, review }) => {
                  const action = nextAction(submission.status, review.importReady);
                  return (
                    <div key={submission.id} className="flex flex-wrap items-center justify-between gap-3 border border-white/80 bg-white px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/submissions/${submission.id}`} className="truncate font-semibold text-navy-900 hover:text-orange-700">
                          {submission.title}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className={`border px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.08em] ${statusBadgeClass(submission.status)}`}>{displayStatusLabel(submission.status)}</span>
                          <span className={`border px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.08em] ${submissionReadinessBadgeClass(review.importReady, submission.status)}`}>{displayReadinessLabel(review, submission.status)}</span>
                          <span className="text-xs text-ink-500">Updated {formatDate(submission.updatedAt)}</span>
                        </div>
                      </div>
                      <Link href={`/admin/submissions/${submission.id}`} className={actionButtonClass(action)}>{action}</Link>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section className="border border-surface-200 bg-white p-4 shadow-sm">
            <AdminFilterChipBar items={presetChipItems} activeKey={selectedPreset} mode="link" aria-label="Submission queue presets" />

            <form method="get" className="mt-4 grid gap-3 border-t border-surface-200 pt-4 lg:grid-cols-[minmax(18rem,1fr)_12rem_auto] lg:items-end">
              {selectedPreset !== "all" ? <input type="hidden" name="preset" value={selectedPreset} /> : null}
              <label className="grid gap-1.5 text-xs font-semibold text-ink-600">
                Search
                <input name="search" defaultValue={searchParams?.search ?? ""} className="h-10 border border-surface-300 bg-white px-3 text-sm text-ink-900 outline-none focus:border-orange-500" placeholder="Title, league, submitter" />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-ink-600">
                Status
                <select name="status" defaultValue={legacyStatus} className="h-10 border border-surface-300 bg-white px-3 text-sm text-ink-900 outline-none focus:border-orange-500">
                  <option value="All">All statuses</option>
                  {statuses.map((status) => <option key={status} value={status}>{displayStatusLabel(status)}</option>)}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="h-10 bg-navy-900 px-4 font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-white hover:bg-orange-600">Search</button>
                <Link href="/admin/submissions" className="flex h-10 items-center border border-surface-300 px-4 font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-ink-700 hover:border-orange-400 hover:text-orange-700">Clear</Link>
              </div>
            </form>
          </section>

          <section className="overflow-x-auto border border-surface-200 bg-white shadow-sm">
            <div className="hidden min-w-[1120px] grid-cols-[minmax(16rem,1fr)_minmax(8rem,0.8fr)_4.25rem_6.75rem_10rem_6.5rem_minmax(8rem,0.75fr)_9rem] border-b border-surface-200 bg-navy-950 px-4 py-2.5 font-mono text-[0.65rem] font-bold uppercase tracking-[0.12em] text-white lg:grid">
              <span>Submission</span>
              <span>League</span>
              <span className="text-center">Games</span>
              <span className="text-center">Player rows</span>
              <span>Status</span>
              <span>Updated</span>
              <span>Submitted by</span>
              <span className="text-right">Action</span>
            </div>

            <div className="divide-y divide-surface-200">
              {visibleRows.map(({ submission, review }) => {
                const action = nextAction(submission.status, review.importReady);
                const submitterName = submission.submittedBy.name ?? submission.submittedBy.username ?? submission.submittedBy.email;
                return (
                  <article key={submission.id} className="grid gap-2.5 px-4 py-3 lg:min-w-[1120px] lg:grid-cols-[minmax(16rem,1fr)_minmax(8rem,0.8fr)_4.25rem_6.75rem_10rem_6.5rem_minmax(8rem,0.75fr)_9rem] lg:items-center lg:gap-4 lg:py-2.5">
                    <div className="min-w-0">
                      <Link href={`/admin/submissions/${submission.id}`} className="block truncate font-display text-lg leading-tight text-navy-900 hover:text-orange-700 lg:text-base">
                        {submission.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-ink-500">Created {formatDate(submission.createdAt)}</p>
                    </div>

                    <div className="min-w-0 text-sm font-semibold text-ink-700">
                      <span className="lg:hidden text-xs font-semibold text-surface-500">League: </span>
                      <span className="break-words">{review.summary.leagueName ?? submission.leagueName ?? "-"}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm font-bold text-navy-900 lg:block lg:text-center">
                      <span className="lg:hidden text-xs font-semibold text-surface-500">Games</span>
                      <span>{review.summary.gameCount}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm font-bold text-navy-900 lg:block lg:text-center">
                      <span className="lg:hidden text-xs font-semibold text-surface-500">Player rows</span>
                      <span>{review.summary.totalPlayerRows}</span>
                    </div>

                    <div className="flex flex-wrap gap-1 lg:flex-col">
                      <span className={`w-fit whitespace-nowrap border px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.08em] ${statusBadgeClass(submission.status)}`}>{displayStatusLabel(submission.status)}</span>
                      <span className={`w-fit whitespace-nowrap border px-1.5 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-[0.08em] ${readinessBadgeClass(review.importReady, submission.status)}`}>{displayReadinessLabel(review, submission.status)}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm text-ink-600 lg:block">
                      <span className="lg:hidden text-xs font-semibold text-surface-500">Updated</span>
                      <span>{formatDate(submission.updatedAt)}</span>
                    </div>

                    <div className="min-w-0 text-sm text-ink-600">
                      <span className="lg:hidden text-xs font-semibold text-surface-500">Submitted by: </span>
                      <span className="break-words">{submitterName}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <Link href={`/admin/submissions/${submission.id}`} className={actionButtonClass(action)}>{action}</Link>
                      <SubmissionRowMenu
                        submissionId={submission.id}
                        submissionTitle={submission.title}
                        submissionStatus={submission.status}
                        canDelete={canDeleteDraftSubmission(submission)}
                        detailHref={`/admin/submissions/${submission.id}`}
                      />
                    </div>
                  </article>
                );
              })}
              {!visibleRows.length ? (
                <AdminEmptyState
                  variant={submissions.length ? "no-matches" : "no-records"}
                  subject="submissions"
                  clearFiltersHref={submissions.length ? "/admin/submissions" : undefined}
                  className="m-4"
                />
              ) : null}
            </div>
          </section>
    </>
  );
}
