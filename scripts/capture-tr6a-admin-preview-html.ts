/**
 * Capture server-rendered /admin/team-ratings HTML for TR-6A documentation.
 * Usage: npx tsx scripts/capture-tr6a-admin-preview-html.ts
 */
import { createHmac } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/prisma";

const cookieName = "peach_basket_portal_session";

function sessionSecret() {
  return process.env.PORTAL_SESSION_SECRET ?? "development-only-peach-basket-portal-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function encodeSession(payload: { userId: string; username: string; role: string; expiresAt: number }) {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { deletedAt: null, role: "ADMIN" },
    orderBy: { createdAt: "asc" }
  });
  if (!admin) throw new Error("No ADMIN user found");

  const session = encodeSession({
    userId: admin.id,
    username: admin.username,
    role: admin.role,
    expiresAt: Date.now() + 60 * 60 * 1000
  });

  const baseUrl = process.env.TR6A_CAPTURE_BASE_URL ?? "http://localhost:3000";
  const response = await fetch(`${baseUrl}/admin/team-ratings?ageGroup=U16&gender=BOYS`, {
    headers: { cookie: `${cookieName}=${session}` }
  });

  if (!response.ok) {
    throw new Error(`Capture failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const outDir = join(process.cwd(), "docs", "planning", "audits");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "tr6a-admin-team-ratings-preview.html");
  writeFileSync(outPath, html, "utf8");
  console.log(`Wrote ${outPath} (${html.length} bytes)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
