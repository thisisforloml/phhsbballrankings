"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthContext";
import { BrandLogo } from "@/components/layout/BrandLogo";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = signIn(String(form.get("email")), String(form.get("password")));
    if (!ok) {
      setError("Use a development premium email ending in @oncourtrankings.ph.");
      return;
    }
    setError("");
    router.push("/leagues");
  }

  const inputClass = "min-h-11 w-full rounded-sm border border-line-500 bg-paper-500 px-3 py-2 text-court-900 outline-none transition focus:border-hardwood-600 focus:bg-white";

  return (
    <main className="min-h-screen bg-paper-500 px-5 pb-16 pt-32 text-court-900">
      <section className="mx-auto w-full max-w-[420px] rounded-sm border border-line-500 bg-white p-6 shadow-panel">
        <BrandLogo />
        <h1 className="mt-8 font-display text-[1.75rem] font-bold text-court-900">Member Login</h1>
        <p className="mt-2 text-court-500">Access league details, analytics, and advanced player data.</p>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-court-700">
            Email address
            <input name="email" type="text" placeholder="member@oncourtrankings.ph" className={inputClass} required />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-court-700">
            Password
            <span className="relative">
              <input name="password" type={showPassword ? "text" : "password"} className={`${inputClass} pr-11`} required />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-court-500" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </span>
          </label>
          <Link href="/login" className="justify-self-end text-sm font-semibold text-hardwood-600 hover:text-hardwood-700 hover:underline">Forgot password?</Link>
          <button className="w-full rounded-sm border border-hardwood-600 bg-hardwood-600 px-4 py-3 text-sm font-bold uppercase tracking-[0.04em] text-white hover:border-hardwood-700 hover:bg-hardwood-700" type="submit">Sign In</button>
        </form>
        {error ? <p className="mt-4 rounded-sm bg-loss-bg p-3 text-sm text-loss-text">{error}</p> : null}
        <div className="my-6 flex items-center gap-3 text-center text-sm text-court-500">
          <span className="h-px flex-1 bg-line-500" />
          <span>New to Peach Basket?</span>
          <span className="h-px flex-1 bg-line-500" />
        </div>
        <Link href="/register" className="block w-full rounded-sm border border-court-900 bg-white px-4 py-3 text-center text-sm font-bold uppercase tracking-[0.04em] text-court-900 hover:bg-paper-500">Get Premium Access</Link>
      </section>
    </main>
  );
}
