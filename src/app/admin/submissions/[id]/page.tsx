import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminAlert } from "@/components/admin/AdminAlert";
import { requireAdminUser } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { getSubmissionPipelineStatus } from "@/lib/submission-audit";
import { buildSubmissionImportPreflight } from "@/lib/submission-import-preflight";
import { canDeleteDraftSubmission, isSubmissionDeleted } from "@/lib/submission-lifecycle";
import { buildSubmissionReview } from "@/lib/submission-review";

import { SubmissionDeleteDraftForm } from "../SubmissionDeleteDraftForm";
import { SimplifiedSubmissionReview } from "./SimplifiedSubmissionReview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Submission Details - Peach Basket Admin",
  description: "Review and publish an organizer submission."
};

type PageProps = {
  params: {
    id: string;
  };
  searchParams?: {
    reviewSuccess?: string;
    reviewError?: string;
    editStats?: string;
  };
};

export default async function AdminSubmissionDetailPage({ params, searchParams }: PageProps) {
  const [, submission] = await Promise.all([
    requireAdminUser(),
    prisma.submission.findUnique({
      where: { id: params.id },
      include: {
        submittedBy: {
          select: { id: true, name: true, username: true, email: true, role: true }
        }
      }
    })
  ]);

  if (!submission) notFound();

  const review = buildSubmissionReview(submission);
  const [preflight, pipelineStatus] = await Promise.all([
    buildSubmissionImportPreflight(submission),
    getSubmissionPipelineStatus(submission.id)
  ]);
  const deleted = isSubmissionDeleted(submission);
  const canDeleteSubmission = canDeleteDraftSubmission(submission);

  return (
    <section className="container-px grid gap-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/submissions" prefetch={false} className="text-sm font-semibold text-amber-700 hover:text-amber-800">
          Back to submissions
        </Link>
        <span className="text-xs text-ink-500">Games &rarr; Teams &rarr; Players &rarr; Approval &rarr; Publish</span>
      </div>

      {deleted ? (
        <AdminAlert variant="readOnly" size="md" title="Deleted submission">
          This record is retained for audit and cannot be reviewed or published.
        </AdminAlert>
      ) : null}

      <SimplifiedSubmissionReview
        submission={submission}
        review={review}
        preflight={preflight}
        pipelineStatus={pipelineStatus}
        reviewSuccess={searchParams?.reviewSuccess}
        reviewError={searchParams?.reviewError}
        editMode={searchParams?.editStats === "1"}
      />

      {canDeleteSubmission ? (
        <details className="border border-red-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-red-800">Delete draft submission</summary>
          <div className="mt-4">
            <SubmissionDeleteDraftForm
              submissionId={submission.id}
              submissionTitle={submission.title}
              submissionStatus={submission.status}
              redirectTo="/admin/submissions"
              compact
            />
          </div>
        </details>
      ) : null}
    </section>
  );
}