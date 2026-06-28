"use client";

import { useFormState } from "react-dom";
import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";
import { updateClaimedPlayerBio, type ClaimantProfileState } from "./actions";

const initialState: ClaimantProfileState = { ok: false, message: "" };

export function ClaimantProfileClient({
  player
}: {
  player: {
    id: string;
    displayName: string;
    firstName: string;
    lastName: string;
    hometown: string;
    region: string;
    position: string | null;
    contactEmail: string | null;
    rating: number | null;
    verifiedGameCount: number | null;
  };
}) {
  const [state, action] = useFormState(updateClaimedPlayerBio, initialState);

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-surface-200 bg-white p-5 shadow-panel">
        <h1 className="font-display text-3xl text-navy-800">{player.displayName}</h1>
        <p className="mt-1 text-sm text-ink-600">
          Rating <span className="font-display font-bold">{player.rating?.toFixed(1) ?? "—"}</span> ·{" "}
          <span className="font-display font-bold">{player.verifiedGameCount ?? 0}</span> games (read-only)
        </p>
      </section>

      <form action={action} className="grid gap-4 rounded-lg border border-surface-200 bg-white p-5 shadow-panel md:grid-cols-2">
        <input type="hidden" name="playerId" value={player.id} />
        <AdminFormFeedback state={state} />
        <label className="grid gap-1 text-sm font-semibold md:col-span-2">Display name<input name="displayName" defaultValue={player.displayName} required className="min-h-10 border border-surface-200 px-3" /></label>
        <label className="grid gap-1 text-sm font-semibold">First name<input name="firstName" defaultValue={player.firstName} required className="min-h-10 border border-surface-200 px-3" /></label>
        <label className="grid gap-1 text-sm font-semibold">Family name<input name="lastName" defaultValue={player.lastName} required className="min-h-10 border border-surface-200 px-3" /></label>
        <label className="grid gap-1 text-sm font-semibold">Hometown<input name="hometown" defaultValue={player.hometown} required className="min-h-10 border border-surface-200 px-3" /></label>
        <label className="grid gap-1 text-sm font-semibold">Region (where they play)<input name="region" defaultValue={player.region} required className="min-h-10 border border-surface-200 px-3" /></label>
        <label className="grid gap-1 text-sm font-semibold">Position<input name="position" defaultValue={player.position ?? ""} className="min-h-10 border border-surface-200 px-3" /></label>
        <label className="grid gap-1 text-sm font-semibold">Contact email<input name="contactEmail" type="email" defaultValue={player.contactEmail ?? ""} className="min-h-10 border border-surface-200 px-3" /></label>
        <AdminSaveButton label="Save profile" className="w-fit md:col-span-2" />
      </form>
    </div>
  );
}
