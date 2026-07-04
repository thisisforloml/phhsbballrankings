import { LoadingStatCards } from "@/components/loading/LoadingStatCards";

type LoadingStatsProps = {
  items?: number;
  className?: string;
};

/** @deprecated Prefer `LoadingStatCards`. */
export function LoadingStats(props: LoadingStatsProps) {
  return <LoadingStatCards {...props} />;
}
