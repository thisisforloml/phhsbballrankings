import { Star } from "lucide-react";

export function StarRating({ stars }: { stars: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${stars} star rating`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`h-4 w-4 ${index < stars ? "fill-amber-500 text-amber-500" : "fill-surface-200 text-surface-200"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
