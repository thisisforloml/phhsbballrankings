import { Skeleton } from "@/components/ui/Skeleton";

type LoadingChartProps = {
  className?: string;
};

export function LoadingChart({ className = "" }: LoadingChartProps) {
  return (
    <div className={`overflow-hidden rounded-sm border border-line-500 bg-white p-4 shadow-panel ${className}`.trim()}>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-4 h-48 w-full md:h-64" />
      <div className="mt-3 flex flex-wrap gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
