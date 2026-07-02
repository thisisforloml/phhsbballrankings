"use client";

import type { SubmissionStatus } from "@prisma/client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { SubmissionDeleteDraftForm } from "./SubmissionDeleteDraftForm";

type SubmissionRowMenuProps = {
  submissionId: string;
  submissionTitle: string;
  submissionStatus: SubmissionStatus;
  canDelete: boolean;
  detailHref: string;
};

export function SubmissionRowMenu({
  submissionId,
  submissionTitle,
  submissionStatus,
  canDelete,
  detailHref
}: SubmissionRowMenuProps) {
  const [open, setOpen] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setShowDelete(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setOpen((value) => !value);
          setShowDelete(false);
        }}
        className="border border-surface-300 px-2.5 py-2 font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-700 hover:border-orange-400 hover:text-orange-700"
      >
        Actions
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 w-56 border border-surface-200 bg-white py-1 shadow-lg"
        >
          <Link
            href={detailHref}
            prefetch={false}
            role="menuitem"
            className="block px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-surface-50"
            onClick={() => setOpen(false)}
          >
            Open detail
          </Link>
          {canDelete ? (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm font-semibold text-red-800 hover:bg-red-50"
              onClick={() => setShowDelete((value) => !value)}
            >
              Delete
            </button>
          ) : null}
        </div>
      ) : null}

      {open && showDelete && canDelete ? (
        <div className="absolute right-0 z-40 mt-1 w-[min(24rem,calc(100vw-2rem))] border border-red-200 bg-red-50 p-4 shadow-lg">
          <SubmissionDeleteDraftForm
            submissionId={submissionId}
            submissionTitle={submissionTitle}
            submissionStatus={submissionStatus}
            redirectTo="/admin/submissions"
            compact
          />
        </div>
      ) : null}
    </div>
  );
}
