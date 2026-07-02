import Image from "next/image";

import { BRAND_ASSETS } from "@/lib/brand";

type PeachBasketLoaderProps = {
  className?: string;
  label?: string;
  /** When true, shows a visible muted label below the logo (in addition to sr-only for assistive tech). */
  showTextLabel?: boolean;
};

export function PeachBasketLoader({
  className = "",
  label = "Loading",
  showTextLabel = false,
}: PeachBasketLoaderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-ping rounded-full bg-scout-orange/15"
        />
        <Image
          src={BRAND_ASSETS.iconSvg}
          alt=""
          width={64}
          height={64}
          className="relative h-14 w-14 animate-pulse object-contain"
          priority
        />
      </div>
      {showTextLabel ? (
        <p className="text-sm font-medium text-scout-500" aria-hidden="true">
          Loading...
        </p>
      ) : null}
      <span className="sr-only">{label}</span>
    </div>
  );
}
