import "server-only";

import { type User,UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { isAdminRole, isPortalRole } from "@/lib/portal-access-rules";
import {
  PORTAL_SESSION_COOKIE_NAME,
  type PortalSessionPayload,
  portalSessionSecret,
} from "@/lib/portal-session-token-edge";
import {
  encodePortalSessionToken,
  verifyPortalSessionTokenSync,
} from "@/lib/portal-session-token-node";

import { prisma } from "./prisma";

const maxAgeSeconds = 60 * 60 * 12;
const PORTAL_USER_CACHE_MS = 60 * 1000;

type CachedPortalUser = {
  user: PortalSessionUser;
  loadedAt: number;
};

const portalUserCache = new Map<string, CachedPortalUser>();

type PortalSessionUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
};

type SessionUserInput = Pick<User, "id" | "username" | "role">;

export { PORTAL_SESSION_COOKIE_NAME as portalSessionCookieName };

function decodeSession(value: string): PortalSessionPayload | null {
  return verifyPortalSessionTokenSync(value, portalSessionSecret());
}

export function createPortalSession(user: SessionUserInput) {
  if (!isPortalRole(user.role)) {
    throw new Error("Portal access requires an administrator or organizer account.");
  }

  const payload: PortalSessionPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    expiresAt: Date.now() + maxAgeSeconds * 1000,
  };

  cookies().set(PORTAL_SESSION_COOKIE_NAME, encodePortalSessionToken(payload, portalSessionSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

function readCachedPortalUser(sessionKey: string): PortalSessionUser | null {
  const entry = portalUserCache.get(sessionKey);
  if (!entry) return null;

  if (Date.now() - entry.loadedAt > PORTAL_USER_CACHE_MS) {
    portalUserCache.delete(sessionKey);
    return null;
  }

  return entry.user;
}

function writeCachedPortalUser(sessionKey: string, user: PortalSessionUser) {
  portalUserCache.set(sessionKey, { user, loadedAt: Date.now() });
}

export function clearPortalUserCacheEntry(sessionKey: string) {
  portalUserCache.delete(sessionKey);
}

export function clearPortalUserCache() {
  portalUserCache.clear();
}

export function clearPortalSession() {
  const rawCookie = cookies().get(PORTAL_SESSION_COOKIE_NAME)?.value;
  if (rawCookie) {
    clearPortalUserCacheEntry(rawCookie);
  }
  cookies().delete(PORTAL_SESSION_COOKIE_NAME);
}

async function loadPortalUserFromDatabase(userId: string): Promise<PortalSessionUser | null> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
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

  if (!user || !isPortalRole(user.role)) return null;
  return user;
}

export async function resolvePortalUserFromSession(
  sessionKey: string,
  payload: PortalSessionPayload,
): Promise<PortalSessionUser | null> {
  const cached = readCachedPortalUser(sessionKey);
  if (cached) return cached;

  const user = await loadPortalUserFromDatabase(payload.userId);
  if (!user) return null;

  writeCachedPortalUser(sessionKey, user);
  return user;
}

export const getPortalUser = cache(async (): Promise<PortalSessionUser | null> => {
  const rawCookie = cookies().get(PORTAL_SESSION_COOKIE_NAME)?.value;
  if (!rawCookie) return null;

  const payload = decodeSession(rawCookie);
  if (!payload) return null;

  return resolvePortalUserFromSession(rawCookie, payload);
});

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

  if (!isAdminRole(user.role)) {
    redirect("/organizer");
  }

  return user;
}

export { isAdminRole, isPortalRole } from "@/lib/portal-access-rules";
