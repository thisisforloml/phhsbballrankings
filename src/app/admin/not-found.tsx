import Link from "next/link";

export default function AdminNotFound() {
  return (
    <div className="mx-auto max-w-2xl border border-surface-200 bg-white p-8 shadow-sm">
      <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.16em] text-orange-600">Admin Portal</p>
      <h1 className="mt-2 font-display text-3xl text-navy-900">Page not found</h1>
      <p className="mt-3 text-sm text-ink-600">
        This admin route does not exist or may have moved. Check the URL or return to the dashboard.
      </p>
      <Link
        href="/admin"
        className="mt-6 inline-block border border-orange-600 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-orange-700 hover:bg-orange-50"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
