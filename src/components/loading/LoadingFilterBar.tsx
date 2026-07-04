import { LoadingFilters } from "@/components/loading/LoadingFilters";

type LoadingFilterBarProps = {
  fields?: number;
  className?: string;
};

/** @deprecated Prefer `LoadingFilters`. */
export function LoadingFilterBar(props: LoadingFilterBarProps) {
  return <LoadingFilters {...props} />;
}
