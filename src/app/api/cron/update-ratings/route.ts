import { NextResponse } from "next/server";

import { authorizeCronRequest } from "@/lib/cron-auth";
import { runWeeklyRatingsUpdate } from "@/lib/weekly-ratings";

export async function GET(request: Request) {
  const auth = authorizeCronRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const result = await runWeeklyRatingsUpdate();
  return NextResponse.json({
    ok: true,
    schedule: "Monday 12:00 PM Philippine Time",
    cronUtc: "0 4 * * 1",
    result
  });
}
