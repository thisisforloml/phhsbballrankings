import { LoadingGameCard } from "@/components/loading/LoadingGameCard";

type LoadingCardGridProps = {
  cards?: number;
  className?: string;
};

export function LoadingCardGrid({ cards = 4, className = "" }: LoadingCardGridProps) {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${className}`.trim()}>
      {Array.from({ length: cards }).map((_, index) => (
        <LoadingGameCard key={index} />
      ))}
    </div>
  );
}
