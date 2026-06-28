import { AdminBadge } from "@/components/admin/AdminBadge";
import {
  displaySubmissionStatus,
  submissionReadinessBadgeClass,
  submissionStatusBadge
} from "@/components/admin/submissionStatus";

const tagMdClassName = "border px-2.5 py-1 text-[0.65rem] tracking-[0.1em]";
const tagSmClassName = "border px-1.5 py-0.5 text-[0.58rem] tracking-[0.08em]";

export function SubmissionStatusBadge({
  status,
  size = "md",
  count
}: {
  status: string;
  size?: "sm" | "md";
  count?: number;
}) {
  const label = count !== undefined ? `${displaySubmissionStatus(status)}: ${count}` : displaySubmissionStatus(status);
  const sizeClassName = size === "sm" ? tagSmClassName : tagMdClassName;

  return (
    <AdminBadge variant="workflow" shape="tag" size="tagSm" mono className={`${sizeClassName} ${submissionStatusBadge(status)}`}>
      {label}
    </AdminBadge>
  );
}

export function ReadinessBadge({
  label,
  importReady,
  status,
  className,
  size = "md"
}: {
  label: string;
  importReady?: boolean;
  status?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const toneClass =
    className ??
    (importReady !== undefined && status !== undefined
      ? submissionReadinessBadgeClass(importReady, status)
      : "border-surface-200 bg-surface-100 text-surface-700");
  const sizeClassName = size === "sm" ? tagSmClassName : tagMdClassName;

  return (
    <AdminBadge variant="workflow" shape="tag" size="tagSm" mono className={`${sizeClassName} ${toneClass}`}>
      {label}
    </AdminBadge>
  );
}
