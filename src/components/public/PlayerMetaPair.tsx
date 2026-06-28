export function PlayerMetaPair({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-neutral-400">{label}</p>
      <p
        className={`mt-1 text-base font-bold leading-snug md:text-[1.05rem] ${accent ? "text-accent-600" : "text-neutral-900"}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}
