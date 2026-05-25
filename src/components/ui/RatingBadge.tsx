export function RatingBadge({ rating, large = false }: { rating: number; large?: boolean }) {
  const color = rating >= 95 ? "text-hardwood-600" : "text-court-900";
  return <span className={`${large ? "text-stat-xl" : "text-stat-sm"} font-display ${color}`}>{rating.toFixed(2)}</span>;
}
