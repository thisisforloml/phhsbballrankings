type ScoutRankChangeProps = {
  delta: number;
  className?: string;
};

export function ScoutRankChange({ delta, className = "" }: ScoutRankChangeProps) {
  if (delta === 0) {
    return (
      <span
        className={`inline-flex items-center font-numeric text-xs font-normal tracking-wide text-scout-500 ${className}`}
        aria-label="No rank change"
      >
        =
      </span>
    );
  }

  const up = delta > 0;
  const label = up ? `Up ${Math.abs(delta)} ranks` : `Down ${Math.abs(delta)} ranks`;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-numeric text-xs font-normal tracking-wide ${
        up ? "text-emerald-400" : "text-rose-400"
      } ${className}`}
      aria-label={label}
    >
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}
