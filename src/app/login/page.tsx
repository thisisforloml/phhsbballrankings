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

  return (
    <main className="min-h-screen bg-surface-50 px-5 pb-16 pt-32">
      <section className="mx-auto w-full max-w-[420px] rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
        <BrandLogo />
        <h1 className="mt-8 font-display text-[1.75rem] font-bold text-navy-800">Member Login</h1>
        <p className="mt-2 text-surface-500">Access league details, analytics, and advanced player data.</p>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-surface-700">
            Email address
            <input name="email" type="text" placeholder="member@oncourtrankings.ph" className="min-h-11 rounded-md border border-surface-200 px-3 py-2" required />
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
          <Link href="/login" className="justify-self-end text-sm font-semibold text-amber-600 hover:text-amber-500 hover:underline">Forgot password?</Link>
          <button className="button primary w-full" type="submit">Sign In</button>
        </form>
        {error ? <p className="mt-4 rounded-md bg-loss-bg p-3 text-sm text-loss-text">{error}</p> : null}
        <div className="my-6 flex items-center gap-3 text-center text-sm text-surface-500">
          <span className="h-px flex-1 bg-surface-200" />
          <span>New to Peach Basket?</span>
          <span className="h-px flex-1 bg-surface-200" />
        </div>
        <Link href="/register" className="button secondary w-full">Get Premium Access</Link>
      </section>
    </main>
  );
}
