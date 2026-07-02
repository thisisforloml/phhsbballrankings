import { UserRole } from "@prisma/client";

const portalRoles = new Set<UserRole>([UserRole.ADMIN, UserRole.ORGANIZER]);

export type AdminRouteGate =
  | { action: "allow" }
  | { action: "redirect"; destination: "/portal/login" | "/organizer" };

export function isPortalRole(role: UserRole): boolean {
  return portalRoles.has(role);
}

export function isAdminRole(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

/** Shared gate for middleware and requireAdminUser (defense in depth). */
export function resolveAdminRouteGate(
  authenticated: boolean,
  role: UserRole | null,
): AdminRouteGate {
  if (!authenticated || !role || !isPortalRole(role)) {
    return { action: "redirect", destination: "/portal/login" };
  }
  if (!isAdminRole(role)) {
    return { action: "redirect", destination: "/organizer" };
  }
  return { action: "allow" };
}
