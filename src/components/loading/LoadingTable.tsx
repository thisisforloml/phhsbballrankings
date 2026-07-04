import { LoadingAvatar } from "@/components/loading/LoadingAvatar";
import { Skeleton } from "@/components/ui/Skeleton";

const defaultDesktopGrid =
  "lg:grid-cols-[3rem_minmax(14rem,1.6fr)_minmax(8rem,1fr)_6rem_4rem_minmax(8rem,0.9fr)_6rem]";

type LoadingTableProps = {
  columns?: number;
  rows?: number;
  showAvatar?: boolean;
  desktopGridClassName?: string;
  className?: string;
};

export function LoadingTable({
  columns = 7,
  rows = 9,
  showAvatar = true,
  desktopGridClassName = defaultDesktopGrid,
  className = "",
}: LoadingTableProps) {
  return (
    <div className={`overflow-hidden rounded-sm border border-line-500 bg-white shadow-panel ${className}`.trim()}>
      <div
        className={`hidden border-b border-line-500 px-4 py-3 lg:grid lg:gap-x-4 ${desktopGridClassName}`}
      >
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} className="mx-auto h-3 w-12" />
        ))}
      </div>

      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={`grid grid-cols-[2.5rem_minmax(0,1fr)_4.25rem] items-center gap-x-3 px-3 py-2.5 lg:gap-x-4 lg:px-4 lg:py-3.5 ${desktopGridClassName} ${
            index < rows - 1 ? "border-b border-line-500" : ""
          }`}
        >
          <Skeleton className="mx-auto h-6 w-6 lg:h-7 lg:w-8" />
          <div className="flex min-w-0 items-center gap-2.5">
            {showAvatar ? <LoadingAvatar /> : null}
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-36 max-w-full" />
              <Skeleton className="h-3 w-28 max-w-[80%]" />
            </div>
          </div>
          <Skeleton className="hidden h-4 w-20 justify-self-center lg:block" />
          <Skeleton className="hidden h-4 w-12 justify-self-center lg:block" />
          <Skeleton className="hidden h-4 w-8 justify-self-center lg:block" />
          <Skeleton className="hidden h-4 w-16 justify-self-center lg:block" />
          <div className="flex flex-col items-end gap-1 lg:items-center">
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}
