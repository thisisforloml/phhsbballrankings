import Image from "next/image";

import { BRAND_ASSETS, BRAND_NAME } from "@/lib/brand";

type LogoVariant = "horizontal" | "stacked" | "icon";

type PeachBasketLogoProps = {
  variant?: LogoVariant;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
};

const VARIANT_SIZES: Record<LogoVariant, { width: number; height: number; src: string; sizes: string }> = {
  icon: { width: 48, height: 48, src: BRAND_ASSETS.icon192, sizes: "48px" },
  horizontal: { width: 640, height: 214, src: BRAND_ASSETS.horizontalLogo, sizes: "(max-width: 640px) 160px, 240px" },
  stacked: { width: 180, height: 180, src: BRAND_ASSETS.appleTouchIcon, sizes: "96px" },
};

const DEFAULT_IMAGE_CLASS = "max-h-12 w-auto object-contain";

export function PeachBasketLogo({
  variant = "horizontal",
  className = "",
  imageClassName = "",
  priority,
}: PeachBasketLogoProps) {
  const { width, height, src, sizes } = VARIANT_SIZES[variant];

  return (
    <span className={`inline-flex shrink-0 items-center ${className}`}>
      <Image
        src={src}
        alt={BRAND_NAME}
        width={width}
        height={height}
        priority={priority}
        sizes={sizes}
        className={`block h-auto max-w-full ${imageClassName || DEFAULT_IMAGE_CLASS}`.trim()}
      />
    </span>
  );
}
