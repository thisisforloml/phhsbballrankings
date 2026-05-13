import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole, type User } from "@prisma/client";
import { prisma } from "./prisma";

const cookieName = "oncourt_portal_session";
const maxAgeSeconds = 60 * 60 * 12;
const allowedRoles = new Set<UserRole>([UserRole.ADMIN, UserRole.ORGANIZER]);

type PortalSessionPayload = {
  userId: string;
  username: string;
  role: UserRole;
  expiresAt: number;
};

type PortalSessionUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
};

type SessionUserInput = Pick<User, "id" | "username" | "role">;

function sessionSecret() {
  const secret = process.env.PORTAL_SESSION_SECRET;

  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "development-only-oncourt-portal-session-secret";

  throw new Error("PORTAL_SESSION_SECRET is required in production.");
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function encodeSession(payload: PortalSessionPayload) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function decodeSession(value: string): PortalSessionPayload | null {
  const [encodedPayload, signature] = value.split(".");

  if (!encodedPayload || !signature) return null;
  if (!safeEqual(sign(encodedPayload), signature)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as PortalSessionPayload;

    if (!payload.userId || !payload.username || !payload.role || !payload.expiresAt) return null;
    if (!allowedRoles.has(payload.role)) return null;
    if (payload.expiresAt <= Date.now()) return null;

    return payload;
  } catch {
    return null;
  }
}

export function createPortalSession(user: SessionUserInput) {
  if (!allowedRoles.has(user.role)) {
    throw new Error("Portal access requires an administrator or organizer account.");
  }

  const payload: PortalSessionPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: Date.now() + maxAgeSeconds * 1000
  };

  cookies().set(cookieName, encodeSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds
  });
}

export function clearPortalSession() {
  cookies().delete(cookieName);
}

export async function getPortalUser(): Promise<PortalSessionUser | null> {
  const rawCookie = cookies().get(cookieName)?.value;
  if (!rawCookie) return null;

  const payload = decodeSession(rawCookie);
  if (!payload) return null;

  const user = await prisma.user.findFirst({
    where: {
      id: payload.userId,
      deletedAt: null
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true
    }
  });

  if (!user || !allowedRoles.has(user.role)) return null;

  return user;
}

export async function requirePortalUser() {
  const user = await getPortalUser();

  if (!user) {
    redirect("/portal/login");
  }

  return user;
}

export async function requireOrganizerUser() {
  return requirePortalUser();
}

export async function requireAdminUser() {
  const user = await requirePortalUser();

  if (user.role !== UserRole.ADMIN) {
    redirect("/organizer");
  }

  return user;
}

export function isPortalRole(role: UserRole) {
  return allowedRoles.has(role);
}

export function isAdminRole(role: UserRole) {
  return role === UserRole.ADMIN;
}