import { Skeleton } from "@/components/ui/Skeleton";

type LoadingMetadataProps = {
  className?: string;
  align?: "left" | "center";
};

/** Small label, title, and detail lines — profile headers, cards, etc. */
export function LoadingMetadata({ className = "", align = "left" }: LoadingMetadataProps) {
  const alignClass = align === "center" ? "mx-auto" : "md:mx-0";

  return (
    <div className={`min-w-0 space-y-3 text-center md:text-left ${className}`.trim()}>
      <Skeleton className={`h-3 w-24 ${alignClass}`} />
      <Skeleton className={`h-9 w-56 max-w-full md:h-10 md:w-72 ${alignClass}`} />
      <Skeleton className={`h-4 w-40 ${alignClass}`} />
      <div className="flex flex-wrap justify-center gap-3 md:justify-start">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}
