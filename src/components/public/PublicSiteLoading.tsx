import { PeachBasketLoader } from "@/components/ui/PeachBasketLoader";

export function PublicSiteLoading() {
  return (
    <div className="flex min-h-[calc(100vh-var(--navbar-height))] flex-col items-center justify-center bg-scout-900">
      <PeachBasketLoader label="Loading page" />
    </div>
  );
}
