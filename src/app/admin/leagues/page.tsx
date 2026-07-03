import { redirect } from "next/navigation";

export default function AdminLeaguesRedirectPage() {
  redirect("/admin/competitions");
}
