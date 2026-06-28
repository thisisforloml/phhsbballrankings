import type { ReactNode } from "react";

export type AdminTableColumn<T> = {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  sticky?: boolean;
  render: (row: T) => ReactNode;
};

type AdminDataTableProps<T> = {
  columns: AdminTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  minWidth?: string;
};

export function AdminDataTable<T>({ columns, rows, rowKey, emptyMessage = "No rows.", minWidth = "48rem" }: AdminDataTableProps<T>) {
  if (!rows.length) {
    return <p className="rounded-lg border border-neutral-200 bg-white px-4 py-6 text-sm text-neutral-500 shadow-card">{emptyMessage}</p>;
  }

  const gridCols = columns.map((col) => (col.sticky ? "minmax(10rem,1.2fr)" : "minmax(6rem,1fr)")).join(" ");

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-card">
      <div style={{ minWidth }}>
        <div className={`grid gap-2 border-b border-neutral-200 bg-neutral-50 px-3 py-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-neutral-500`} style={{ gridTemplateColumns: gridCols }}>
          {columns.map((col) => (
            <span key={col.key} className={col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"}>
              {col.header}
            </span>
          ))}
        </div>
        {rows.map((row) => (
          <div key={rowKey(row)} className="grid gap-2 border-b border-neutral-100 px-3 py-2.5 text-sm text-neutral-700 last:border-b-0 hover:bg-neutral-50" style={{ gridTemplateColumns: gridCols }}>
            {columns.map((col) => (
              <div key={col.key} className={`${col.sticky ? "sticky left-0 z-10 bg-white" : ""} ${col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"}`}>
                {col.render(row)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
