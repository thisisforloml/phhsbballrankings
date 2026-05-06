export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
      <strong className="font-display text-stat-md text-navy-800">{value}</strong>
      <span className="mt-2 block font-mono text-mono-sm uppercase text-ink-500">{label}</span>
    </article>
  );
}
