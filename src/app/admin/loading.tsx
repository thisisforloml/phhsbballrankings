import { PeachBasketLoader } from "@/components/ui/PeachBasketLoader";

export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-4xl border border-surface-200 bg-white p-8 shadow-sm">
      <PeachBasketLoader className="py-10" label="Loading admin portal" />
    </div>
  );
}
