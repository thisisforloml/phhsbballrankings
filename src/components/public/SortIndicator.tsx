type SortDirection = "asc" | "desc";

export function SortIndicator({ direction }: { direction: SortDirection }) {
  return (
    <span
      aria-hidden="true"
      className={`ml-1 inline-block h-0 w-0 align-middle ${
        direction === "asc"
          ? "border-x-[4px] border-b-[6px] border-x-transparent border-b-current"
          : "border-x-[4px] border-t-[6px] border-x-transparent border-t-current"
      }`}
    />
  );
}
