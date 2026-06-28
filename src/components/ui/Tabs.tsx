"use client";

import type { ReactNode } from "react";

export type TabItem = {
  id: string;
  label: ReactNode;
  count?: number;
};

type TabsProps = {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
};

/** One tab pattern (underline style) for workspaces with multiple views. */
export function Tabs({ items, active, onChange, className = "" }: TabsProps) {
  return (
    <div className={`flex flex-wrap gap-1 border-b border-neutral-200 ${className}`} role="tablist">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
              isActive
                ? "border-accent-500 text-neutral-900"
                : "border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-800"
            }`}
          >
            {item.label}
            {typeof item.count === "number" ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold ${
                  isActive ? "bg-accent-100 text-accent-700" : "bg-neutral-100 text-neutral-500"
                }`}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
