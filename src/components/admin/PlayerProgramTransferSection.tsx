"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";

import { transferPlayerProgram, type UpdatePlayerBioState,updatePlayerProgram } from "@/app/admin/players/actions";
import { AdminFormFeedback } from "@/components/admin/AdminFormFeedback";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";
import type { PlayerProgramTransferHistoryRow } from "@/lib/admin/load-player-transfer-history";

import type { ManagedPlayer } from "./AdminPlayerEditPanel";

const initialFormState: UpdatePlayerBioState = { ok: false, message: "" };
const inputClassName =
  "min-h-10 w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-ink-900 shadow-sm focus:border-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-700/15";
const labelClassName = "text-xs font-semibold uppercase tracking-wide text-ink-500";
const actionButtonClassName =
  "border border-surface-300 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:border-orange-300 hover:text-orange-800";
const dangerButtonClassName =
  "border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50";
const primaryButtonClassName =
  "border border-navy-800 bg-navy-900 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-800";

type ProgramOption = { id: string; fullName: string; abbreviation?: string | null; type?: string };
type WizardStep = "destination" | "date" | "reason" | "preview";

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-surface-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-navy-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ContextSummary({ player }: { player: ManagedPlayer }) {
  return (
    <div className="rounded-md border border-surface-200 bg-surface-50 p-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Current program</dt>
          <dd className="mt-1 font-semibold text-ink-900">{player.currentProgramFullName ?? "No program assigned"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Parent group</dt>
          <dd className="mt-1 font-semibold text-ink-900">{player.parentGroupProgramFullName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Current team</dt>
          <dd className="mt-1 font-semibold text-ink-900">{player.currentTeamName ?? "—"}</dd>
          <p className="mt-1 text-xs text-ink-500">Derived from verified game evidence</p>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Age group</dt>
          <dd className="mt-1 font-semibold text-ink-900">{player.displayAgeBracket}</dd>
        </div>
      </dl>
    </div>
  );
}

function TransferHistoryTimeline({ rows }: { rows: PlayerProgramTransferHistoryRow[] }) {
  if (!rows.length) {
    return <p className="text-sm text-ink-500">No program transfers recorded yet.</p>;
  }

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <article key={row.id} className="rounded-md border border-surface-200 bg-white p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
            <span>{row.fromProgramName}</span>
            <span className="text-ink-400" aria-hidden="true">
              ↓
            </span>
            <span>{row.toProgramName}</span>
          </div>
          <dl className="mt-2 grid gap-1 text-xs text-ink-600 sm:grid-cols-3">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-ink-500">Date</dt>
              <dd>{row.effectiveDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-ink-500">Administrator</dt>
              <dd>{row.administratorName}</dd>
            </div>
            <div className="sm:col-span-1">
              <dt className="font-semibold uppercase tracking-wide text-ink-500">Reason</dt>
              <dd>{row.reason ?? "—"}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

function TransferWizard({
  player,
  programOptions,
  transferAction,
  transferState,
  onClose,
}: {
  player: ManagedPlayer;
  programOptions: ProgramOption[];
  transferAction: (payload: FormData) => void;
  transferState: UpdatePlayerBioState;
  onClose: () => void;
}) {
  const [step, setStep] = useState<WizardStep>("destination");
  const [destinationProgramId, setDestinationProgramId] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("");

  const destinationOptions = useMemo(
    () => programOptions.filter((program) => program.id !== player.currentProgramId),
    [player.currentProgramId, programOptions],
  );
  const destinationProgram = destinationOptions.find((program) => program.id === destinationProgramId) ?? null;

  const steps: WizardStep[] = ["destination", "date", "reason", "preview"];
  const stepIndex = steps.indexOf(step);

  function goNext() {
    if (step === "destination" && !destinationProgramId) return;
    if (step === "date" && !effectiveDate) return;
    if (step === "reason" && !reason.trim()) return;
    const next = steps[stepIndex + 1];
    if (next) setStep(next);
  }

  function goBack() {
    const previous = steps[stepIndex - 1];
    if (previous) setStep(previous);
  }

  return (
    <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-navy-900">Transfer wizard</h4>
        <button type="button" onClick={onClose} className={actionButtonClassName}>
          Cancel
        </button>
      </div>

      <ol className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
        <li className={stepIndex >= 0 ? "text-navy-900" : ""}>Current</li>
        <li aria-hidden="true">→</li>
        <li className={stepIndex >= 0 ? "text-navy-900" : ""}>Destination</li>
        <li aria-hidden="true">→</li>
        <li className={stepIndex >= 1 ? "text-navy-900" : ""}>Date</li>
        <li aria-hidden="true">→</li>
        <li className={stepIndex >= 2 ? "text-navy-900" : ""}>Reason</li>
        <li aria-hidden="true">→</li>
        <li className={stepIndex >= 3 ? "text-navy-900" : ""}>Preview</li>
        <li aria-hidden="true">→</li>
        <li>Confirm</li>
      </ol>

      <div className="mt-4 grid gap-4">
        <div className="rounded-md border border-surface-200 bg-white p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Current program</p>
          <p className="mt-1 font-semibold text-ink-900">{player.currentProgramFullName}</p>
        </div>

        {step === "destination" ? (
          <label className="grid gap-1.5">
            <span className={labelClassName}>Destination program</span>
            <select
              value={destinationProgramId}
              onChange={(event) => setDestinationProgramId(event.target.value)}
              className={inputClassName}
              required
            >
              <option value="">Select destination…</option>
              {destinationOptions.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.fullName}
                  {program.abbreviation ? ` (${program.abbreviation})` : ""}
                  {program.type ? ` · ${program.type}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {step === "date" ? (
          <label className="grid max-w-xs gap-1.5">
            <span className={labelClassName}>Effective date</span>
            <input
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className={inputClassName}
              required
            />
          </label>
        ) : null}

        {step === "reason" ? (
          <label className="grid gap-1.5">
            <span className={labelClassName}>Reason</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              rows={4}
              className={inputClassName}
              required
            />
          </label>
        ) : null}

        {step === "preview" ? (
          <div className="rounded-md border border-surface-200 bg-white p-4 text-sm text-ink-700">
            <p className="font-semibold text-ink-900">Transfer preview</p>
            <dl className="mt-3 grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <dt className="sr-only">Programs</dt>
                <dd className="font-semibold text-ink-900">{player.currentProgramFullName}</dd>
                <span className="text-ink-400">↓</span>
                <dd className="font-semibold text-ink-900">{destinationProgram?.fullName}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Effective date</dt>
                <dd>{effectiveDate}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Reason</dt>
                <dd>{reason}</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-ink-500">
              Confirms one history record and updates the program link only. Game stats, ratings, snapshots, and team evidence are not modified.
            </p>
          </div>
        ) : null}
      </div>

      {step === "preview" ? (
        <form action={transferAction} className="mt-4 grid gap-3">
          <AdminFormFeedback state={transferState} />
          <input type="hidden" name="playerId" value={player.id} />
          <input type="hidden" name="expectedFromProgramId" value={player.currentProgramId ?? ""} />
          <input type="hidden" name="destinationProgramId" value={destinationProgramId} />
          <input type="hidden" name="effectiveDate" value={effectiveDate} />
          <input type="hidden" name="reason" value={reason} />
          <label className="flex items-start gap-2 text-sm text-ink-700">
            <input type="checkbox" name="confirmTransfer" required className="mt-0.5" />
            <span>I confirm this program transfer. Historical games, stats, and ratings remain unchanged.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={goBack} className={actionButtonClassName}>
              Back
            </button>
            <AdminSaveButton label="Confirm transfer" variant="ops" className="w-fit" />
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {stepIndex > 0 ? (
            <button type="button" onClick={goBack} className={actionButtonClassName}>
              Back
            </button>
          ) : null}
          <button type="button" onClick={goNext} className={primaryButtonClassName}>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}

export function PlayerProgramTransferSection({
  player,
  programOptions,
  onSaved,
}: {
  player: ManagedPlayer;
  programOptions: ProgramOption[];
  onSaved?: () => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [programState, programAction] = useFormState(updatePlayerProgram, initialFormState);
  const [transferState, transferAction] = useFormState(transferPlayerProgram, initialFormState);

  useEffect(() => {
    setAssignOpen(false);
    setRemoveOpen(false);
    setWizardOpen(false);
  }, [player.id]);

  useEffect(() => {
    if (programState.ok || transferState.ok) onSaved?.();
  }, [onSaved, programState.ok, transferState.ok]);

  const transferHistory = player.transferHistory ?? [];

  if (!player.currentProgramId) {
    return (
      <FormSection title="Program assignment">
        <AdminFormFeedback state={programState} />
        <ContextSummary player={player} />
        <p className="mt-3 text-sm text-ink-600">Assign an operational program when this player has no explicit program link.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setAssignOpen((open) => !open)} className={primaryButtonClassName}>
            Assign program
          </button>
        </div>
        {assignOpen ? (
          <form action={programAction} className="mt-3 grid gap-3">
            <input type="hidden" name="playerId" value={player.id} />
            <input type="hidden" name="programMode" value="assign" />
            <label className="grid max-w-xl gap-1.5">
              <span className={labelClassName}>Operational program</span>
              <select name="programId" required className={inputClassName} defaultValue="">
                <option value="">Select program…</option>
                {programOptions.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.fullName}
                    {program.abbreviation ? ` (${program.abbreviation})` : ""}
                    {program.type ? ` · ${program.type}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-ink-500">Only updates the program link. No transfer history row is created for first-time assignment.</p>
            <AdminSaveButton label="Assign program" variant="ops" className="w-fit" />
          </form>
        ) : null}
      </FormSection>
    );
  }

  return (
    <FormSection title="Transfer center">
      <AdminFormFeedback state={programState} />
      {!wizardOpen ? <AdminFormFeedback state={transferState} /> : null}
      <ContextSummary player={player} />

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setWizardOpen((open) => !open)} className={primaryButtonClassName}>
          {wizardOpen ? "Close transfer wizard" : "Transfer player"}
        </button>
        <button type="button" onClick={() => setRemoveOpen((open) => !open)} className={dangerButtonClassName}>
          Remove program
        </button>
      </div>

      {wizardOpen && player.currentProgramId ? (
        <TransferWizard
          player={player}
          programOptions={programOptions}
          transferAction={transferAction}
          transferState={transferState}
          onClose={() => setWizardOpen(false)}
        />
      ) : null}

      {removeOpen ? (
        <form action={programAction} className="mt-3">
          <input type="hidden" name="playerId" value={player.id} />
          <input type="hidden" name="programMode" value="remove" />
          <p className="mb-3 text-sm text-ink-600">
            Remove only clears the explicit program link. Historical games, stats, ratings, and transfer history stay unchanged.
          </p>
          <AdminSaveButton label="Remove program" className="w-fit" />
        </form>
      ) : null}

      <div className="mt-4 border-t border-surface-200 pt-4">
        <h4 className="text-sm font-semibold text-navy-900">Transfer history</h4>
        <p className="mt-1 text-sm text-ink-600">Newest transfers first.</p>
        <div className="mt-3">
          <TransferHistoryTimeline rows={transferHistory} />
        </div>
      </div>
    </FormSection>
  );
}
