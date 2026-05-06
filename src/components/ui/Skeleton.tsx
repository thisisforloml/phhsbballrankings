export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`skeleton block rounded-md ${className}`} />;
}

export function LeaderboardSkeleton() {
  return (
    <div className="grid gap-3 rounded-lg border border-surface-200 bg-white p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="grid grid-cols-[4rem_1fr_6rem_6rem] items-center gap-4">
          <Skeleton className="h-5" />
          <Skeleton className="h-8" />
          <Skeleton className="h-7" />
          <Skeleton className="h-7" />
        </div>
      ))}
    </div>
  );
}
