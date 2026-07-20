import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { ok: false, message: "Licensed member access is coming soon." },
    { status: 503 }
  );
}
