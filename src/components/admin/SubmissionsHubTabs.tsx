"use client";

import Link from "next/link";
import { SUBMISSION_HUB_TABS, submissionHubTabHref, type SubmissionHubTab } from "@/lib/admin/submission-hub-tabs";

export function SubmissionsHubTabs({
  active,
  preserve
}: {
  active: SubmissionHubTab;
  preserve?: Record<string, string | undefined>;
}) {
  return (
    <nav aria-label="Game stats sections" className="flex flex-wrap gap-1 border-b border-surface-200">
      {SUBMISSION_HUB_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={submissionHubTabHref(tab.key, preserve)}
          className={`border-b-2 px-3 py-2 text-sm font-semibold transition ${active === tab.key ? "border-orange-500 text-navy-900" : "border-transparent text-ink-500 hover:border-surface-300 hover:text-ink-800"}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
