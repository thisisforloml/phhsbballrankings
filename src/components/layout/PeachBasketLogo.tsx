import { BRAND_ASSETS, BRAND_NAME } from "@/lib/brand";

type LogoVariant = "horizontal" | "stacked" | "icon";

type PeachBasketLogoProps = {
  variant?: LogoVariant;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  /** Default `png` for runtime UI; pass `svg` for vector master assets when needed */
  format?: "svg" | "png";
};

const VARIANT_DIMENSIONS: Record<LogoVariant, { width: number; height: number }> = {
  icon: { width: 48, height: 48 },
  horizontal: { width: 240, height: 80 },
  stacked: { width: 96, height: 96 },
};

const DEFAULT_IMAGE_CLASS = "max-h-12 w-auto object-contain";

export function PeachBasketLogo({
  variant = "horizontal",
  className = "",
  imageClassName = "",
  priority,
  format = "png",
}: PeachBasketLogoProps) {
  const svgSrc =
    variant === "stacked"
      ? BRAND_ASSETS.stackedLogo
      : variant === "icon"
        ? BRAND_ASSETS.icon
        : BRAND_ASSETS.horizontalLogo;

  const pngSrc =
    variant === "stacked"
      ? BRAND_ASSETS.stackedLogoPng
      : variant === "icon"
        ? BRAND_ASSETS.iconPng
        : BRAND_ASSETS.horizontalLogoPng;

  const src = format === "png" ? pngSrc : svgSrc;
  const { width, height } = VARIANT_DIMENSIONS[variant];

  return (
    <span className={`inline-flex shrink-0 items-center ${className}`}>
      <img
        src={src}
        alt={BRAND_NAME}
        width={width}
        height={height}
        loading={priority ? "eager" : undefined}
        className={`block h-auto max-w-full ${imageClassName || DEFAULT_IMAGE_CLASS}`.trim()}
      />
    </span>
  );
}
