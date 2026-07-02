import { redirect } from "next/navigation";

export default function AdministratorRedirectPage() {
  redirect("/admin/intake");
}
