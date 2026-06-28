import type { ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: ReactNode;
  /** Render a cell for a row. */
  cell: (row: T, index: number) => ReactNode;
  align?: "left" | "right" | "center";
  /** Make this column sticky (identity column) on horizontal scroll. */
  sticky?: boolean;
  className?: string;
  headerClassName?: string;
  width?: string;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  empty?: ReactNode;
  className?: string;
  onRowClick?: (row: T) => void;
  dense?: boolean;
};

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center"
};

/**
 * One shared table primitive (admin + public). Horizontal scroll with optional
 * sticky identity column, consistent header, zebra-free clean rows, empty state.
 */
export function DataTable<T>({ columns, rows, rowKey, empty, className = "", onRowClick, dense = false }: DataTableProps<T>) {
  const pad = dense ? "px-3 py-2" : "px-4 py-3";
  return (
    <div className={`overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-card ${className}`}>
      <table className="w-full min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50">
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                style={col.width ? { width: col.width } : undefined}
                className={`${pad} text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-neutral-500 ${
                  alignClass[col.align ?? "left"]
                } ${col.sticky ? "sticky left-0 z-10 bg-neutral-50" : ""} ${col.headerClassName ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-neutral-400">
                {empty ?? "No records to show."}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={rowKey(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-neutral-100 last:border-0 ${
                  onRowClick ? "cursor-pointer hover:bg-neutral-50" : ""
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${pad} text-neutral-700 ${alignClass[col.align ?? "left"]} ${
                      col.sticky ? "sticky left-0 z-10 bg-white" : ""
                    } ${col.className ?? ""}`}
                  >
                    {col.cell(row, index)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
