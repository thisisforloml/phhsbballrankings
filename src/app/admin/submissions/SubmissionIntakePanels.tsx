import { AdminAlert } from "@/components/admin/AdminAlert";
import { UrlImportClient } from "@/app/admin/tools/submissions/UrlImportClient";
import { createOrganizerSubmission } from "@/app/organizer/submissions/actions";
import { createAdminJsonSubmission } from "./actions";

function CommonFileFields({ titlePlaceholder }: { titlePlaceholder: string }) {
  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">
        Submission title
        <input name="title" required maxLength={160} className="min-h-10 rounded-md border border-surface-200 px-3 py-2 text-sm normal-case tracking-normal text-ink-900" placeholder={titlePlaceholder} />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">
          League name
          <input name="leagueName" maxLength={160} className="min-h-10 rounded-md border border-surface-200 px-3 py-2 text-sm normal-case tracking-normal text-ink-900" placeholder="Optional" />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">
          Game date
          <input name="gameDate" type="date" className="min-h-10 rounded-md border border-surface-200 px-3 py-2 text-sm normal-case tracking-normal text-ink-900" />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-surface-600 md:col-span-2">
          Game number
          <input name="gameNumber" maxLength={120} className="min-h-10 rounded-md border border-surface-200 px-3 py-2 text-sm normal-case tracking-normal text-ink-900" placeholder="Optional" />
        </label>
      </div>
    </div>
  );
}

export function SubmissionJsonIntakePanel({
  jsonCreated,
  jsonError
}: {
  jsonCreated?: string;
  jsonError?: string;
}) {
  return (
    <section className="border border-surface-200 bg-white p-4 shadow-sm">
      {jsonCreated ? (
        <AdminAlert variant="success" size="sm" className="mb-4">
          JSON submission created.
        </AdminAlert>
      ) : null}
      {jsonError ? (
        <AdminAlert variant="error" size="sm" className="mb-4">
          {decodeURIComponent(jsonError)}
        </AdminAlert>
      ) : null}
      <form action={createAdminJsonSubmission} className="grid gap-3" encType="multipart/form-data">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1.5 text-xs font-semibold text-surface-700">
            Title
            <input name="title" required maxLength={160} className="min-h-10 border border-surface-200 px-3 py-2 text-sm" placeholder="UAAP S88 batch JSON" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-surface-700">
            League
            <input name="leagueName" maxLength={160} className="min-h-10 border border-surface-200 px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-surface-700">
            Game date
            <input name="gameDate" type="date" className="min-h-10 border border-surface-200 px-3 py-2 text-sm" />
          </label>
        </div>
        <label className="grid gap-1.5 text-xs font-semibold text-surface-700">
          JSON
          <textarea name="rawText" rows={8} className="border border-surface-200 px-3 py-2 font-mono text-xs" placeholder="Paste JSON or upload below." />
        </label>
        <label className="grid gap-1.5 text-xs font-semibold text-surface-700">
          JSON file
          <input name="file" type="file" accept=".json,application/json" className="border border-surface-200 px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="w-fit bg-navy-900 px-4 py-2 font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-white hover:bg-orange-600">
          Create submission
        </button>
      </form>
    </section>
  );
}

export function SubmissionFileIntakePanel({
  created,
  error
}: {
  created?: string;
  error?: string;
}) {
  return (
    <section className="border border-surface-200 bg-white p-4 shadow-sm">
      {created ? (
        <AdminAlert variant="success" size="sm" className="mb-4">
          Spreadsheet submission created.
        </AdminAlert>
      ) : null}
      {error ? (
        <AdminAlert variant="error" size="sm" className="mb-4">
          {decodeURIComponent(error)}
        </AdminAlert>
      ) : null}
      <form action={createOrganizerSubmission} className="grid gap-3" encType="multipart/form-data">
        <input type="hidden" name="returnTo" value="/admin/submissions?tab=file" />
        <CommonFileFields titlePlaceholder="PYBC U16 box score upload" />
        <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-surface-600">
          Spreadsheet
          <input name="file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="rounded-md border border-surface-200 px-3 py-2 text-sm normal-case tracking-normal text-ink-900" />
        </label>
        <button type="submit" className="button primary min-h-10 w-fit px-4 py-2 text-sm">
          Create draft
        </button>
      </form>
    </section>
  );
}

export function SubmissionUrlIntakePanel() {
  return (
    <section className="border border-surface-200 bg-white p-4 shadow-sm">
      <UrlImportClient />
    </section>
  );
}

