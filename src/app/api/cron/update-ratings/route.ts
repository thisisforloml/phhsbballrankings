import { NextResponse } from "next/server";
import { runWeeklyRatingsUpdate } from "@/lib/weekly-ratings";

export async function GET() {
  const result = await runWeeklyRatingsUpdate();
  return NextResponse.json({
    ok: true,
    schedule: "Monday 12:00 PM Philippine Time",
    cronUtc: "0 4 * * 1",
    result
  });
}
