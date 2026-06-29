import { Star } from "lucide-react";

export function StarRating({
  stars,
  activeClassName = "fill-gold-500 text-gold-500",
}: {
  stars: number;
  activeClassName?: string;
}) {
  return (
    <span className="inline-flex gap-1" aria-label={`${stars} star rating`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`h-4 w-4 ${index < stars ? activeClassName : "fill-line-500 text-line-500"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
