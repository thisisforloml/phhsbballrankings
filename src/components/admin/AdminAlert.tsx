import type { ReactNode } from "react";

export type AdminAlertVariant = "success" | "error" | "warning" | "info" | "readOnly";
export type AdminAlertSize = "sm" | "md";

const variantClasses: Record<AdminAlertVariant, string> = {
  success: "border-green-200 bg-green-50 text-green-800",
  error: "border-red-200 bg-red-50 text-red-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-surface-200 bg-surface-50 text-ink-600",
  readOnly: "border-navy-200 bg-navy-50 text-navy-900"
};

const sizeClasses: Record<AdminAlertSize, string> = {
  sm: "border px-3 py-2 text-sm",
  md: "rounded-md border px-4 py-3 text-sm"
};

function alertRole(variant: AdminAlertVariant): "alert" | "status" {
  return variant === "success" || variant === "error" || variant === "warning" ? "alert" : "status";
}

export function AdminAlert({
  variant,
  size = "sm",
  title,
  className = "",
  children
}: {
  variant: AdminAlertVariant;
  size?: AdminAlertSize;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={alertRole(variant)}
      className={[sizeClasses[size], variantClasses[variant], "font-semibold", className].filter(Boolean).join(" ")}
    >
      {title ? (
        <>
          <strong className="block">{title}</strong>
          <div className="mt-1">{children}</div>
        </>
      ) : (
        children
      )}
    </div>
  );
}
