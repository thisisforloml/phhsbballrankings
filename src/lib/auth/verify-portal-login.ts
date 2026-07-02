import { UserRole } from "@prisma/client";

import { hashPassword, verifyPassword } from "@/lib/password-hash";
import { prisma } from "@/lib/prisma";

export type PortalLoginResult =
  | { ok: true; user: { id: string; username: string; role: UserRole } }
  | { ok: false; reason: "missing" | "invalid" | "forbidden" };

export async function verifyPortalLoginCredentials(
  login: string,
  password: string,
): Promise<PortalLoginResult> {
  if (!login || !password) {
    return { ok: false, reason: "missing" };
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: login }, { email: login.toLowerCase() }],
      deletedAt: null,
    },
    select: {
      id: true,
      username: true,
      role: true,
      passwordHash: true,
    },
  });

  if (!user) {
    return { ok: false, reason: "invalid" };
  }

  const verification = await verifyPassword(password, user.passwordHash);
  if (!verification.valid) {
    return { ok: false, reason: "invalid" };
  }

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.ORGANIZER) {
    return { ok: false, reason: "forbidden" };
  }

  if (verification.needsUpgrade) {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password) },
    });
  }

  return {
    ok: true,
    user: { id: user.id, username: user.username, role: user.role },
  };
}
