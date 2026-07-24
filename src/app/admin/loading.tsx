export default function AdminLoading() {
  return (
    <div className="w-full animate-pulse border border-surface-200 bg-white p-4 shadow-sm" role="status" aria-label="Loading admin page">
      <div className="h-6 w-48 bg-surface-200" />
      <div className="mt-2 h-3 w-72 max-w-full bg-surface-100" />
      <div className="mt-5 grid gap-2">
        <div className="h-12 bg-surface-100" />
        <div className="h-12 bg-surface-100" />
        <div className="h-12 bg-surface-100" />
      </div>
      <span className="sr-only">Loading admin page</span>
    </div>
  );
}
