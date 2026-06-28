export const SUBMISSION_HUB_TABS = [
  { key: "review", label: "Review" },
  { key: "json", label: "JSON" },
  { key: "file", label: "File" },
  { key: "url", label: "URL" },
  { key: "manual", label: "Manual" }
] as const;

export type SubmissionHubTab = (typeof SUBMISSION_HUB_TABS)[number]["key"];

export function resolveSubmissionHubTab(value: string | undefined): SubmissionHubTab {
  if (value && SUBMISSION_HUB_TABS.some((tab) => tab.key === value)) {
    return value as SubmissionHubTab;
  }
  return "review";
}

export function submissionHubTabHref(tab: SubmissionHubTab, preserve?: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  if (tab !== "review") query.set("tab", tab);
  for (const [key, value] of Object.entries(preserve ?? {})) {
    if (value?.trim()) query.set(key, value.trim());
  }
  const value = query.toString();
  return value ? `/admin/submissions?${value}` : "/admin/submissions";
}
