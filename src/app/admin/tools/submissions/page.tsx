import { redirect } from "next/navigation";

export default function AdminSubmissionToolsRedirectPage({
  searchParams
}: {
  searchParams?: { created?: string; error?: string };
}) {
  const query = new URLSearchParams();
  query.set("tab", "file");
  if (searchParams?.created) query.set("created", searchParams.created);
  if (searchParams?.error) query.set("error", searchParams.error);
  redirect(`/admin/submissions?${query.toString()}`);
}
