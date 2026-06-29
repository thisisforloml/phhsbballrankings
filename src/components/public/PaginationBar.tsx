type PaginationControlsProps = {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
};

export function PaginationControls({ page, pageCount, onChange, className = "" }: PaginationControlsProps) {
  if (pageCount <= 1) return null;

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={`font-numeric border px-2.5 py-1 text-xs font-normal tracking-wide ${
            page === item
              ? "border-court-900 bg-court-900 text-white"
              : "border-line-500 bg-white text-court-600 hover:border-court-700"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

type PaginationSummaryProps = {
  pageStart: number;
  pageEnd: number;
  total: number;
  labelSuffix?: string;
  unit?: string;
  className?: string;
};

export function PaginationSummary({
  pageStart,
  pageEnd,
  total,
  labelSuffix,
  unit = "players",
  className = "",
}: PaginationSummaryProps) {
  return (
    <p className={`text-xs font-semibold text-court-500 ${className}`}>
      Showing{" "}
      <span className="font-numeric">{pageStart}</span>–<span className="font-numeric">{pageEnd}</span> of{" "}
      <span className="font-numeric">{total}</span> {unit}
      {labelSuffix ? ` | ${labelSuffix}` : ""}
    </p>
  );
}

type PaginationToolbarProps = {
  pageStart: number;
  pageEnd: number;
  total: number;
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  labelSuffix?: string;
  className?: string;
};

export function PaginationToolbar({
  pageStart,
  pageEnd,
  total,
  page,
  pageCount,
  onChange,
  labelSuffix,
  className = "",
}: PaginationToolbarProps) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 ${className}`}>
      <PaginationSummary pageStart={pageStart} pageEnd={pageEnd} total={total} labelSuffix={labelSuffix} />
      <PaginationControls page={page} pageCount={pageCount} onChange={onChange} />
    </div>
  );
}

type PaginationBarProps = {
  pageStart: number;
  pageEnd: number;
  total: number;
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  labelSuffix?: string;
  className?: string;
};

export function PaginationBar({
  pageStart,
  pageEnd,
  total,
  page,
  pageCount,
  onChange,
  labelSuffix,
  className = ""
}: PaginationBarProps) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border border-line-500 bg-white px-3 py-2 shadow-panel ${className}`}>
      <PaginationSummary pageStart={pageStart} pageEnd={pageEnd} total={total} labelSuffix={labelSuffix} />
      <PaginationControls page={page} pageCount={pageCount} onChange={onChange} />
    </div>
  );
}
