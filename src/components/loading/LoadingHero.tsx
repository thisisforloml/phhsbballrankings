import { LoadingMetadata } from "@/components/loading/LoadingMetadata";
import { LoadingTabs } from "@/components/loading/LoadingTabs";
import { Skeleton } from "@/components/ui/Skeleton";

type LoadingHeroProps = {
  variant?: "page" | "profile";
  className?: string;
};

/** Page title block or profile header with portrait and metadata. */
export function LoadingHero({ variant = "page", className = "" }: LoadingHeroProps) {
  if (variant === "profile") {
    return (
      <div className={`border-b border-line-500 bg-white ${className}`.trim()}>
        <div className="container-px pb-6 pt-24">
          <div className="mx-auto grid max-w-[950px] gap-6 md:grid-cols-[11rem_1fr] md:items-end">
            <Skeleton className="mx-auto h-44 w-36 rounded-sm md:mx-0 md:h-52 md:w-40" />
            <LoadingMetadata align="center" />
          </div>
        </div>
        <LoadingTabs />
      </div>
    );
  }

  return (
    <div className={`container-px py-6 md:py-8 ${className}`.trim()}>
      <div className="mx-auto max-w-[74rem]">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="mt-3 h-9 w-72 max-w-full md:h-11 md:w-96" />
        <Skeleton className="mt-3 h-4 w-40" />
      </div>
    </div>
  );
}
