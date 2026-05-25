import { Star } from "lucide-react";

export function StarRating({ stars }: { stars: number }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${stars} star rating`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`h-4 w-4 ${index < stars ? "fill-gold-500 text-gold-500" : "fill-line-500 text-line-500"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
