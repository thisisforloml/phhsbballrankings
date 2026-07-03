import { redirect } from "next/navigation";

export default function AdminLeagueDetailRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/admin/competitions/${params.id}`);
}
