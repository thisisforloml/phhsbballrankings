import { CheckCircle2 } from "lucide-react";

export function VerifiedBadge({ label = "" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 border border-gold-500 bg-gold-500 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.1em] text-court-900" aria-label={label || "Verified profile"} title={label || "Verified profile"}>
      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}


