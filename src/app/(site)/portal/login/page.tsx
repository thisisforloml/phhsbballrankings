import { UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/layout/BrandLogo";
import { verifyPortalLoginCredentials } from "@/lib/auth/verify-portal-login";
import { childLogger,logAuthFailure } from "@/lib/logger";
import { createPortalSession } from "@/lib/portal-auth";
import { assertRateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { getClientIpFromHeaders, getRequestIdFromHeaders } from "@/lib/request-context";

async function login(formData: FormData) {
  "use server";

  const loginValue = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const requestId = getRequestIdFromHeaders();
  const clientIp = getClientIpFromHeaders();
  const log = childLogger({ requestId, event: "portal_login" });

  try {
    assertRateLimit("login:ip", clientIp, RATE_LIMIT_PRESETS.loginIp(), "Login");
    if (loginValue) {
      assertRateLimit(
        "login:account",
        loginValue.toLowerCase(),
        RATE_LIMIT_PRESETS.loginAccount(),
        "Login",
      );
    }
  } catch {
    logAuthFailure(log, "rate_limited", { clientIp, login: loginValue || undefined });
    redirect(`/portal/login?error=ratelimit`);
  }

  const result = await verifyPortalLoginCredentials(loginValue, password);
  if (!result.ok) {
    logAuthFailure(log, result.reason, { clientIp, login: loginValue || undefined });
    redirect(`/portal/login?error=${result.reason}`);
  }

  createPortalSession(result.user);
  const destination = result.user.role === UserRole.ADMIN ? "/admin/submissions" : "/organizer";
  log.info({ userId: result.user.id, role: result.user.role, clientIp }, "portal login succeeded");
  revalidatePath(destination, "layout");
  redirect(destination);
}

function errorMessage(error?: string) {
  if (error === "missing") return "Username/email and password are required.";
  if (error === "forbidden") return "This account cannot access Peach Basket portals.";
  if (error === "ratelimit") return "Too many login attempts. Please wait and try again.";
  if (error === "invalid") return "Invalid portal credentials.";
  return null;
}

export default function PortalLoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  const message = errorMessage(searchParams?.error);

  return (
    <main className="min-h-screen bg-surface-50 px-5 pb-16 pt-32">
      <section className="mx-auto w-full max-w-[420px] rounded-lg border border-surface-200 bg-white p-6 shadow-panel">
        <BrandLogo />
        <h1 className="mt-8 font-display text-[1.75rem] font-bold text-navy-800">Portal Sign In</h1>
        <p className="mt-2 text-surface-500">For Peach Basket administrators and approved organizer partners.</p>
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
          <button className="button primary w-full" type="submit">Sign In</button>
        </form>
        <p className="mt-5 text-sm text-surface-500">
          Admin accounts open the internal Admin Portal. Organizer accounts open the Organizer Portal for submissions and stat entry.
        </p>
      </section>
    </main>
  );
}
