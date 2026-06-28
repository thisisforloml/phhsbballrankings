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
    <div className={`flex flex-wrap items-center justify-between gap-3 border border-line-500 bg-white px-3 py-2 ${className}`}>
      <p className="text-xs font-bold text-court-500">
        Showing {pageStart}-{pageEnd} of {total} players{labelSuffix ? ` | ${labelSuffix}` : ""}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-1">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              className={`border px-2.5 py-1 text-xs font-black ${
                page === item
                  ? "border-court-900 bg-court-900 text-white"
                  : "border-line-500 bg-paper-500 text-court-600 hover:border-court-900"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
