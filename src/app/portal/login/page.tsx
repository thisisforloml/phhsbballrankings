"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const organizerKey = "oncourt-organizer-session";

export default function OrganizerLoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    window.localStorage.setItem(organizerKey, JSON.stringify({ email: String(form.get("email")), role: "organizer" }));
    router.push("/portal");
  }

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
        <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-surface-400">Not yet a partner? Apply at oncourtrankings.ph/partner</p>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-surface-700">
            Email address
            <input name="email" type="email" className="min-h-11 rounded-md border border-surface-200 px-3 py-2" required />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-surface-700">
            Password
            <span className="relative">
              <input name="password" type={showPassword ? "text" : "password"} className="min-h-11 w-full rounded-md border border-surface-200 px-3 py-2 pr-11" required />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-surface-500" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </span>
          </label>
          <button className="button secondary w-full bg-navy-800 text-white hover:bg-navy-700" type="submit">Sign In</button>
        </form>
        <p className="mt-5 text-sm text-surface-500">Organizer accounts are created by OnCourt after partnership approval. If you have not yet applied, visit oncourtrankings.ph/partner.</p>
      </section>
    </main>
  );
}
