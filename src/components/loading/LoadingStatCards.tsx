import { Skeleton } from "@/components/ui/Skeleton";

type LoadingStatCardsProps = {
  items?: number;
  className?: string;
};

export function LoadingStatCards({ items = 4, className = "" }: LoadingStatCardsProps) {
  return (
    <div className={`grid grid-cols-2 gap-3 sm:grid-cols-4 ${className}`.trim()}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="rounded-sm border border-line-500 bg-white p-3 shadow-panel">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="mt-2 h-7 w-16" />
        </div>
      ))}
    </div>
  );
}
