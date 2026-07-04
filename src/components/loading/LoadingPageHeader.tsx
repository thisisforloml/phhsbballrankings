import { LoadingHero } from "@/components/loading/LoadingHero";

type LoadingPageHeaderProps = {
  className?: string;
};

/** @deprecated Prefer `LoadingHero` with `variant="page"`. */
export function LoadingPageHeader(props: LoadingPageHeaderProps) {
  return <LoadingHero variant="page" {...props} />;
}
