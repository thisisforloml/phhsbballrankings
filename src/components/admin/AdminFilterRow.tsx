"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type AdminFilterSelect = {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
};

function filterGridClassName(selectCount: number) {
  if (selectCount <= 1) return "lg:grid-cols-[minmax(18rem,1fr)_12rem_auto]";
  if (selectCount === 2) return "lg:grid-cols-[minmax(18rem,1fr)_12rem_12rem_auto]";
  return "lg:grid-cols-[minmax(18rem,1fr)_12rem_12rem_12rem_auto]";
}

function SelectField({
  select,
  onSelectChange,
}: {
  select: AdminFilterSelect;
  onSelectChange?: (name: string, value: string) => void;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-ink-600">
      {select.label}
      <select
        value={select.value}
        onChange={(event) => onSelectChange?.(select.name, event.target.value)}
        className="h-10 w-full min-w-0 max-w-full border border-surface-300 bg-white px-3 text-sm text-ink-900 outline-none focus:border-orange-500"
      >
        {select.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AdminFilterRow({
  searchLabel = "Search",
  searchPlaceholder,
  searchValue,
  onSearchChange,
  searchLeadingIcon,
  selects = [],
  onSelectChange,
  onClear,
  clearHref,
  showClear = true,
  resultCount,
  resultLabel = "shown",
  withTopDivider = false,
  compact = false,
  className = "",
}: {
  searchLabel?: string;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchLeadingIcon?: ReactNode;
  selects?: AdminFilterSelect[];
  onSelectChange?: (name: string, value: string) => void;
  onClear?: () => void;
  clearHref?: string;
  showClear?: boolean;
  resultCount?: number;
  resultLabel?: string;
  withTopDivider?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const clearControl = showClear ? (
    clearHref ? (
      <Link
        href={clearHref}
        className="flex h-10 items-center border border-surface-300 px-4 font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-ink-700 hover:border-orange-400 hover:text-orange-700"
      >
        Clear
      </Link>
    ) : onClear ? (
      <button
        type="button"
        onClick={onClear}
        className="flex h-10 items-center border border-surface-300 px-4 font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-ink-700 hover:border-orange-400 hover:text-orange-700"
      >
        Clear
      </button>
    ) : null
  ) : null;

  const metaRow = (
    <div className="flex flex-wrap items-center gap-2">
      {typeof resultCount === "number" ? (
        <span className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.1em] text-ink-500">
          {resultCount} {resultLabel}
        </span>
      ) : null}
      {clearControl}
    </div>
  );

  if (compact) {
    return (
      <div className={`grid min-w-0 gap-3 ${withTopDivider ? "border-t border-surface-200 pt-4" : ""} ${className}`}>
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-ink-600">
          {searchLabel}
          <span className={searchLeadingIcon ? "relative min-w-0" : "min-w-0"}>
            {searchLeadingIcon}
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className={`h-10 w-full min-w-0 border border-surface-300 bg-white text-sm text-ink-900 outline-none focus:border-orange-500 ${searchLeadingIcon ? "pl-10 pr-3" : "px-3"}`}
            />
          </span>
        </label>

        {selects.length === 2 ? (
          <div className="grid min-w-0 grid-cols-2 gap-3">
            {selects.map((select) => (
              <SelectField key={select.name} select={select} onSelectChange={onSelectChange} />
            ))}
          </div>
        ) : selects.length > 0 ? (
          <>
            <SelectField select={selects[0]} onSelectChange={onSelectChange} />
            {selects.length > 1 ? (
              <div className={`grid min-w-0 gap-3 ${selects.length > 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                {selects.slice(1).map((select) => (
                  <SelectField key={select.name} select={select} onSelectChange={onSelectChange} />
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {metaRow}
      </div>
    );
  }

  return (
    <div className={`grid gap-3 ${withTopDivider ? "border-t border-surface-200 pt-4" : ""} ${className}`}>
      <div className={`grid gap-3 lg:items-end ${filterGridClassName(selects.length)}`}>
        <label className="grid gap-1.5 text-xs font-semibold text-ink-600">
          {searchLabel}
          <span className={searchLeadingIcon ? "relative" : undefined}>
            {searchLeadingIcon}
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className={`h-10 w-full border border-surface-300 bg-white text-sm text-ink-900 outline-none focus:border-orange-500 ${searchLeadingIcon ? "pl-10 pr-3" : "px-3"}`}
            />
          </span>
        </label>

        {selects.map((select) => (
          <SelectField key={select.name} select={select} onSelectChange={onSelectChange} />
        ))}

        {metaRow}
      </div>
    </div>
  );
}
