export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-4xl border border-surface-200 bg-white p-8 shadow-sm" role="status" aria-live="polite">
      <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-orange-600">Admin Portal</p>
      <h1 className="mt-2 font-display text-2xl text-navy-900">Loading…</h1>
      <p className="mt-2 text-sm text-ink-600">Fetching admin data. This usually takes a moment.</p>
      <div className="mt-6 h-1 w-full overflow-hidden bg-navy-100">
        <div className="h-full w-1/3 animate-pulse bg-orange-500" />
      </div>
    </div>
  );
}
