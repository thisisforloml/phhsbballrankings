import { Skeleton } from "@/components/ui/Skeleton";

type LoadingTabsProps = {
  tabs?: number;
  className?: string;
  maxWidthClassName?: string;
};

export function LoadingTabs({
  tabs = 6,
  className = "",
  maxWidthClassName = "max-w-[950px]",
}: LoadingTabsProps) {
  return (
    <div className={`container-px ${className}`.trim()}>
      <div className={`mx-auto flex ${maxWidthClassName} gap-2 overflow-hidden border-t border-line-500 pt-3`}>
        {Array.from({ length: tabs }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-24 shrink-0 rounded-sm" />
        ))}
      </div>
    </div>
  );
}
