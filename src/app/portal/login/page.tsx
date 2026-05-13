import { createHash } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createPortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";

function passwordHash(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

async function login(formData: FormData) {
  "use server";

  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!login || !password) {
    redirect("/portal/login?error=missing");
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: login },
        { email: login.toLowerCase() }
      ],
      deletedAt: null
    }
  });

  if (!user || user.passwordHash !== passwordHash(password)) {
    redirect("/portal/login?error=invalid");
  }

  if (user.role !== "ADMIN" && user.role !== "ORGANIZER") {
    redirect("/portal/login?error=forbidden");
  }

  createPortalSession(user);
  redirect("/portal");
}

function errorMessage(error?: string) {
  if (error === "missing") return "Username/email and password are required.";
  if (error === "forbidden") return "This account cannot access the organizer portal.";
  if (error === "invalid") return "Invalid portal credentials.";
  return null;
}

export default function OrganizerLoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  const message = errorMessage(searchParams?.error);

  return (
    <main className="min-h-screen bg-surface-50 px-5 pb-16 pt-32">
      <section className="mx-auto w-full max-w-[420px] rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
        <Link href="/" className="block text-center leading-none" aria-label="OnCourt Rankings Philippines home">
          <img src="/oncourt-logo.png" alt="" className="mx-auto h-20 w-20 rounded-md object-contain" />
          <span className="mt-3 block font-display text-4xl font-extrabold text-navy-800">ONCOURT</span>
          <span className="block font-mono text-[0.65rem] uppercase tracking-[0.18em] text-surface-500">Rankings PH</span>
        </Link>
        <h1 className="mt-8 font-display text-[1.75rem] font-bold text-navy-800">Organizer Portal</h1>
        <p className="mt-2 text-surface-500">For league administrators and statisticians partnered with OnCourt.</p>
        <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-surface-400">
          Not yet a partner?{" "}
          <Link href="/partner" className="text-amber-500 hover:underline">
            Apply to partner with us
          </Link>
        </p>
        {message ? <p className="mt-5 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-800">{message}</p> : null}
        <form action={login} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-surface-700">
            Username or email address
            <input name="login" className="min-h-11 rounded-md border border-surface-200 px-3 py-2" required />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-surface-700">
            Password
            <input name="password" type="password" className="min-h-11 w-full rounded-md border border-surface-200 px-3 py-2" required />
          </label>
          <button className="button secondary w-full bg-navy-800 text-white hover:bg-navy-700" type="submit">Sign In</button>
        </form>
        <p className="mt-5 text-sm text-surface-500">
          Organizer accounts are created by OnCourt after partnership approval. If you have not yet applied, visit the partnership page.
        </p>
      </section>
    </main>
  );
}