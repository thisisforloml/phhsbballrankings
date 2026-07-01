import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole, type User } from "@prisma/client";
import { prisma } from "./prisma";

const cookieName = "oncourt_portal_session";
const maxAgeSeconds = 60 * 60 * 12;
const allowedRoles = new Set<UserRole>([UserRole.ADMIN, UserRole.ORGANIZER]);

// TEMP: read-only auth lifecycle trace — remove after diagnosis
const PORTAL_AUTH_TRACE = "[PORTAL_AUTH_TRACE]";

function traceId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function requestContext() {
  const headerStore = headers();
  console.log("[RAW_HEADERS]", {
    cookie: headersList.get("cookie"),
    host: headersList.get("host"),
    origin: headersList.get("origin"),
    referer: headersList.get("referer"),
    nextUrl: headersList.get("next-url"),
    rsc: headersList.get("rsc"),
    nextRouterPrefetch: headersList.get("next-router-prefetch"),
    secFetchSite: headersList.get("sec-fetch-site"),
    secFetchMode: headersList.get("sec-fetch-mode"),
    secFetchDest: headersList.get("sec-fetch-dest"),
  });
  const cookieHeader = headerStore.get("cookie") ?? "";

  return {
    referer: headerStore.get("referer"),
    nextUrl: headerStore.get("next-url"),
    xInvokePath: headerStore.get("x-invoke-path"),
    xMatchedPath: headerStore.get("x-matched-path"),
    xNextjsData: headerStore.get("x-nextjs-data"),
    rsc: headerStore.get("rsc"),
    nextRouterPrefetch: headerStore.get("next-router-prefetch"),
    secFetchMode: headerStore.get("sec-fetch-mode"),
    secFetchDest: headerStore.get("sec-fetch-dest"),
    cookieHeaderHasSession: cookieHeader.includes(`${cookieName}=`),
  };
}

type AuthAudit = {
  cookiesGetHasValue: boolean;
  decodeSessionOk: boolean;
  decodedUserId: string | null;
  decodedUsername: string | null;
  decodedRole: string | null;
  prismaUserFound: boolean;
  prismaUserId: string | null;
  prismaUsername: string | null;
  prismaRole: string | null;
  allowedRoleOk: boolean;
};

function auditPortalSession(): AuthAudit {
  const rawCookie = cookies().get(cookieName)?.value;
  const audit: AuthAudit = {
    cookiesGetHasValue: Boolean(rawCookie),
    decodeSessionOk: false,
    decodedUserId: null,
    decodedUsername: null,
    decodedRole: null,
    prismaUserFound: false,
    prismaUserId: null,
    prismaUsername: null,
    prismaRole: null,
    allowedRoleOk: false,
  };

  if (!rawCookie) return audit;

  const payload = decodeSession(rawCookie);
  if (!payload) return audit;

  audit.decodeSessionOk = true;
  audit.decodedUserId = payload.userId;
  audit.decodedUsername = payload.username;
  audit.decodedRole = payload.role;

  return audit;
}

async function auditPortalUser(): Promise<AuthAudit> {
  const audit = auditPortalSession();
  if (!audit.decodeSessionOk || !audit.decodedUserId) return audit;

  const user = await prisma.user.findFirst({
    where: {
      id: audit.decodedUserId,
      deletedAt: null,
    },
    select: {
      id: true,
      username: true,
      role: true,
    },
  });

  if (!user) return audit;

  audit.prismaUserFound = true;
  audit.prismaUserId = user.id;
  audit.prismaUsername = user.username;
  audit.prismaRole = user.role;
  audit.allowedRoleOk = allowedRoles.has(user.role);

  return audit;
}

function logTrace(event: string, fields: Record<string, unknown>) {
  console.log(PORTAL_AUTH_TRACE, JSON.stringify({ event, ...fields }));
}

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

  logTrace("createPortalSession", {
    id: traceId(),
    userId: user.id,
    username: user.username,
    role: user.role,
    ...requestContext(),
  });
}

export function clearPortalSession() {
  cookies().delete(cookieName);
}

export async function getPortalUser(): Promise<PortalSessionUser | null> {
  const id = traceId();
  const ctx = requestContext();
  const rawCookie = cookies().get(cookieName)?.value;
  const audit = auditPortalSession();

  if (!rawCookie) {
    logTrace("getPortalUser", { id, ...ctx, audit });
    return null;
  }

  if (!audit.decodeSessionOk) {
    logTrace("getPortalUser", { id, ...ctx, audit: { ...audit, cookiesGetHasValue: true } });
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      id: audit.decodedUserId!,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
    },
  });

  audit.prismaUserFound = Boolean(user);
  audit.prismaUserId = user?.id ?? null;
  audit.prismaUsername = user?.username ?? null;
  audit.prismaRole = user?.role ?? null;
  audit.allowedRoleOk = user ? allowedRoles.has(user.role) : false;

  if (!user || !allowedRoles.has(user.role)) {
    logTrace("getPortalUser", { id, ...ctx, audit });
    return null;
  }

  logTrace("getPortalUser.success", {
    id,
    userId: user.id,
    username: user.username,
    role: user.role,
    ...ctx,
    audit,
  });

  return user;
}

export async function requirePortalUser() {
  const id = traceId();
  const ctx = requestContext();
  const user = await getPortalUser();

  if (!user) {
    const audit = await auditPortalUser();
    logTrace("redirect", {
      id,
      guard: "requirePortalUser",
      target: "/portal/login",
      ...ctx,
      audit,
    });
    redirect("/portal/login");
  }

  return user;
}

export async function requireOrganizerUser() {
  return requirePortalUser();
}

export async function requireAdminUser() {
  const id = traceId();
  const ctx = requestContext();
  const user = await requirePortalUser();

  if (user.role !== UserRole.ADMIN) {
    logTrace("redirect", {
      id,
      guard: "requireAdminUser",
      target: "/organizer",
      userId: user.id,
      role: user.role,
      ...ctx,
    });
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