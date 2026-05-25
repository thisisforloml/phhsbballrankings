export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="border border-line-500 bg-white p-5">
      <strong className="font-display text-stat-md font-black text-court-900">{value}</strong>
      <span className="mt-2 block text-xs font-bold uppercase tracking-[0.12em] text-court-500">{label}</span>
    </article>
  );
}
