import { Skeleton } from "@/components/ui/Skeleton";

type LoadingAvatarProps = {
  className?: string;
};

export function LoadingAvatar({ className = "h-10 w-10" }: LoadingAvatarProps) {
  return <Skeleton className={`shrink-0 rounded-full ${className}`} />;
}
