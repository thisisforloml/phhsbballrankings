import { CheckCircle2 } from "lucide-react";

export function VerifiedBadge({ label = "" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-navy-50 px-3 py-1 font-mono text-mono-sm uppercase text-navy-800" aria-label={label || "Verified profile"} title={label || "Verified profile"}>
      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}


