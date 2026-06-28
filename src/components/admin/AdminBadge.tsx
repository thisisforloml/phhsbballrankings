import type { ReactNode } from "react";

export type AdminBadgeVariant =
  | "workflow"
  | "health"
  | "review"
  | "success"
  | "warning"
  | "error"
  | "readOnly";

export type AdminBadgeShape = "pill" | "tag";
export type AdminBadgeSize = "2xs" | "xs" | "sm" | "md" | "tagSm" | "tagMd";

const pillVariantClasses: Record<Exclude<AdminBadgeVariant, "workflow" | "health">, string> = {
  success: "bg-green-50 text-green-800",
  error: "bg-red-50 text-red-800",
  warning: "bg-amber-50 text-amber-800",
  review: "bg-amber-100 text-amber-900",
  readOnly: "bg-surface-100 text-surface-700"
};

const tagVariantClasses: Record<Exclude<AdminBadgeVariant, "workflow" | "health" | "review">, string> = {
  success: "border-green-200 bg-green-50 text-green-800",
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  readOnly: "border-surface-200 bg-surface-100 text-surface-700"
};

const sizeClasses: Record<AdminBadgeSize, string> = {
  "2xs": "px-2 py-1 text-[0.62rem]",
  xs: "px-2 py-1 text-[0.65rem]",
  sm: "px-3 py-1 text-[0.65rem]",
  md: "px-4 py-2 text-mono-sm",
  tagSm: "border px-2 py-1 text-[0.65rem]",
  tagMd: "border px-2.5 py-1 text-[0.65rem] font-bold tracking-[0.1em]"
};

function resolveVariantClasses(variant: AdminBadgeVariant, shape: AdminBadgeShape, pass?: boolean) {
  if (variant === "health") {
    return shape === "tag"
      ? pass ? tagVariantClasses.success : tagVariantClasses.error
      : pass ? pillVariantClasses.success : pillVariantClasses.error;
  }
  if (variant === "workflow") return "";
  if (shape === "tag") {
    if (variant === "review") return tagVariantClasses.warning;
    return tagVariantClasses[variant];
  }
  return pillVariantClasses[variant];
}

export function AdminBadge({
  variant,
  shape = "pill",
  size = "sm",
  mono = true,
  pass,
  className = "",
  children
}: {
  variant: AdminBadgeVariant;
  shape?: AdminBadgeShape;
  size?: AdminBadgeSize;
  mono?: boolean;
  pass?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const geometry = shape === "pill" ? "rounded-full" : size === "tagSm" || size === "tagMd" ? "" : "border";
  const typography = mono ? "font-mono uppercase" : "font-semibold uppercase";
  const variantClasses = resolveVariantClasses(variant, shape, pass);

  return (
    <span className={[geometry, sizeClasses[size], typography, variantClasses, className].filter(Boolean).join(" ")}>
      {children}
    </span>
  );
}
