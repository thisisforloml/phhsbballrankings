"use client";

import Link from "next/link";
import { adminFilterChipClassName, adminFilterChipCountClassName } from "@/components/admin/adminFilterStyles";

export type AdminFilterChipItem = {
  key: string;
  label: string;
  count?: number;
  href?: string;
};

export function AdminFilterChipBar({
  items,
  activeKey,
  mode = "button",
  onSelect,
  className = "",
  "aria-label": ariaLabel = "Filter presets"
}: {
  items: AdminFilterChipItem[];
  activeKey: string;
  mode?: "link" | "button";
  onSelect?: (key: string) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`} aria-label={ariaLabel}>
      {items.map((item) => {
        const active = activeKey === item.key;
        const content = (
          <>
            {item.label}
            {typeof item.count === "number" ? <span className={adminFilterChipCountClassName(active)}> ({item.count})</span> : null}
          </>
        );

        if (mode === "link" && item.href) {
          return (
            <Link key={item.key} href={item.href} className={adminFilterChipClassName(active)}>
              {content}
            </Link>
          );
        }

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect?.(item.key)}
            className={adminFilterChipClassName(active)}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
