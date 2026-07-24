"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";

import {
  initialPlayerMergeActionState,
  mergeDuplicatePlayer,
} from "./actions";

function SubmitButton({ duplicateCount }: { duplicateCount: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="button danger disabled:cursor-wait disabled:opacity-60">
      {pending ? "Merging..." : `Merge ${duplicateCount} duplicate ${duplicateCount === 1 ? "profile" : "profiles"}`}
    </button>
  );
}

export function PlayerMergeExecuteForm(props: {
  canonicalPlayerId: string;
  duplicatePlayerIds: string[];
  expectedFingerprint: string;
}) {
  const router = useRouter();
  const [state, action] = useFormState(mergeDuplicatePlayer, initialPlayerMergeActionState);

  useEffect(() => {
    if (!state.ok) return;
    router.replace("/admin/data-health/player-duplicates?merged=1");
    router.refresh();
  }, [router, state.ok]);

  return (
    <form action={action} className="grid gap-3 border-t border-red-200 bg-red-50 p-4">
      <input type="hidden" name="canonicalPlayerId" value={props.canonicalPlayerId} />
      <input type="hidden" name="duplicatePlayerIds" value={props.duplicatePlayerIds.join(",")} />
      <input type="hidden" name="expectedFingerprint" value={props.expectedFingerprint} />

      <label className="grid gap-1.5 text-sm font-semibold text-ink-800">
        Merge reason
        <textarea
          name="reason"
          required
          maxLength={500}
          rows={2}
          placeholder="Confirmed same athlete; duplicates created from name variations."
          className="rounded-md border border-surface-300 bg-white px-3 py-2 font-normal"
        />
      </label>

      <label className="flex items-start gap-2 text-sm text-ink-700">
        <input type="checkbox" name="confirmHistory" required className="mt-1" />
        <span>Historical Team IDs, game context, and stat values will not be changed.</span>
      </label>

      <label className="grid max-w-xs gap-1.5 text-sm font-semibold text-ink-800">
        Type MERGE to confirm
        <input name="confirmText" required autoComplete="off" className="rounded-md border border-red-300 bg-white px-3 py-2" />
      </label>

      {state.message ? (
        <p role="status" className={`text-sm font-semibold ${state.ok ? "text-green-800" : "text-red-800"}`}>
          {state.message}
        </p>
      ) : null}

      <div><SubmitButton duplicateCount={props.duplicatePlayerIds.length} /></div>
    </form>
  );
}
