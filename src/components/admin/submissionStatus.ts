export function displaySubmissionStatus(status: string) {
  if (status === "DRAFT") return "Draft";
  if (status === "IMPORTED") return "Imported";
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  if (status === "UNDER_REVIEW") return "Under review";
  if (status === "SUBMITTED") return "Submitted";
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function submissionStatusBadge(status: string) {
  if (status === "DRAFT") return "border-surface-200 bg-surface-50 text-surface-700";
  if (status === "IMPORTED") return "border-navy-200 bg-navy-50 text-navy-800";
  if (status === "APPROVED") return "border-green-200 bg-green-50 text-green-800";
  if (status === "REJECTED") return "border-red-200 bg-red-50 text-red-800";
  if (status === "UNDER_REVIEW") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-surface-200 bg-surface-100 text-surface-700";
}

export const READY_TO_PUBLISH_LABEL = "Ready to publish";

export function readyToPublishBadge() {
  return "border-blue-200 bg-blue-50 text-blue-800";
}

export function submissionReadinessBadgeClass(importReady: boolean, status: string) {
  if (status === "APPROVED" && importReady) return readyToPublishBadge();
  if (status === "IMPORTED") return submissionStatusBadge("IMPORTED");
  return importReady ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800";
}
