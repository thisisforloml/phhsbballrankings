type ScoutSectionLabelProps = {
  children: string;
  className?: string;
};

export function ScoutSectionLabel({ children, className = "" }: ScoutSectionLabelProps) {
  return (
    <h2
      className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-scout-orange-bright ${className}`}
    >
      <span aria-hidden="true" className="inline-block h-4 w-1 bg-scout-orange" />
      {children}
    </h2>
  );
}
