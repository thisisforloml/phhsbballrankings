import { Skeleton } from "@/components/ui/Skeleton";

type LoadingGameCardProps = {
  className?: string;
};

export function LoadingGameCard({ className = "" }: LoadingGameCardProps) {
  return (
    <div
      className={`overflow-hidden rounded-sm border border-line-500 bg-white shadow-panel ${className}`.trim()}
    >
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-32 max-w-full" />
        <Skeleton className="h-3 w-24 max-w-[80%]" />
        <div className="grid grid-cols-3 gap-2 border-t border-line-500 pt-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    </div>
  );
}
