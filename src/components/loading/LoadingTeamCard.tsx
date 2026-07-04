import { LoadingAvatar } from "@/components/loading/LoadingAvatar";
import { Skeleton } from "@/components/ui/Skeleton";

type LoadingTeamCardProps = {
  className?: string;
};

export function LoadingTeamCard({ className = "" }: LoadingTeamCardProps) {
  return (
    <div
      className={`overflow-hidden rounded-sm border border-line-500 bg-white p-4 shadow-panel ${className}`.trim()}
    >
      <div className="flex items-center gap-3">
        <LoadingAvatar className="h-12 w-12" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-36 max-w-full" />
          <Skeleton className="h-3 w-28 max-w-[80%]" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line-500 pt-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}
