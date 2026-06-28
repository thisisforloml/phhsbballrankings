import "server-only";

/**
 * Authorize Vercel cron (or manual ops) invocations.
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set.
 * In production, requests are rejected if CRON_SECRET is unset or the header does not match.
 */
export function authorizeCronRequest(request: Request): { ok: true } | { ok: false; status: number; message: string } {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, status: 503, message: "CRON_SECRET is not configured." };
    }
    return { ok: true };
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  return { ok: true };
}
