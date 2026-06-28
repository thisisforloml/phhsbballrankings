import { redirect } from "next/navigation";

export default function AdminLiveStatsRedirectPage({
  searchParams
}: {
  searchParams?: { error?: string };
}) {
  const query = new URLSearchParams({ tab: "manual" });
  if (searchParams?.error) query.set("error", searchParams.error);
  redirect(`/admin/submissions?${query.toString()}`);
}
