export function RatingBadge({ rating, large = false }: { rating: number; large?: boolean }) {
  const color = rating >= 95 ? "text-amber-500" : "text-navy-800";
  return <span className={`${large ? "text-stat-xl" : "text-stat-sm"} font-display ${color}`}>{rating.toFixed(2)}</span>;
}
