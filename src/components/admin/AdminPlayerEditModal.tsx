"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFormState } from "react-dom";

import { loadAdminPlayerDetail, updatePlayerBio, type UpdatePlayerBioState } from "@/app/admin/players/actions";
import { AdminPlayerEditPanel, type ManagedPlayer } from "@/components/admin/AdminPlayerEditPanel";

const initialFormState: UpdatePlayerBioState = { ok: false, message: "" };

export function AdminPlayerEditModal({
  player,
  programOptions,
  open,
  onClose,
}: {
  player: ManagedPlayer | null;
  programOptions: Array<{ id: string; fullName: string; abbreviation?: string | null; type?: string }>;
  open: boolean;
  onClose: () => void;
}) {
  const [state, formAction] = useFormState(updatePlayerBio, initialFormState);
  const [detailPlayer, setDetailPlayer] = useState<ManagedPlayer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (state.ok) window.location.reload();
  }, [state.ok]);

  useEffect(() => {
    if (!open || !player?.id) {
      setDetailPlayer(null);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    void loadAdminPlayerDetail(player.id).then((detail) => {
      if (cancelled) return;
      setDetailPlayer(detail);
      setDetailLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, player?.id]);

  if (!open || !player) return null;

  const panelPlayer = detailPlayer?.id === player.id ? detailPlayer : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button type="button" className="fixed inset-0 bg-navy-950/55 backdrop-blur-sm" onClick={onClose} aria-label="Close player editor" />
      <div className="relative z-10 w-full max-w-5xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 grid size-9 place-items-center rounded-full border border-white/20 bg-navy-900/80 text-white shadow-sm transition hover:bg-navy-800"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        {detailLoading && !panelPlayer ? (
          <div className="rounded-lg border border-surface-200 bg-white p-12 text-center text-sm text-ink-500 shadow-sm">Loading player details…</div>
        ) : panelPlayer ? (
          <AdminPlayerEditPanel player={panelPlayer} programOptions={programOptions} formAction={formAction} state={state} />
        ) : (
          <div className="rounded-lg border border-surface-200 bg-white p-12 text-center text-sm text-ink-500 shadow-sm">Could not load player details.</div>
        )}
      </div>
    </div>
  );
}
