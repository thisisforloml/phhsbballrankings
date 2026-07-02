import "server-only";

import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: {
    service: "peach-basket",
  },
  redact: {
    paths: ["password", "passwordHash", "req.headers.authorization", "req.headers.cookie"],
    remove: true,
  },
  ...(process.env.NODE_ENV !== "production"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
      }
    : {}),
});

export function newRequestId(): string {
  return crypto.randomUUID();
}

export function newAdminActionId(): string {
  return `admin_${crypto.randomUUID()}`;
}

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

export function logPrismaError(
  log: pino.Logger,
  error: unknown,
  context: Record<string, unknown>,
) {
  if (error && typeof error === "object" && "code" in error) {
    log.error({ err: error, ...context, prismaCode: (error as { code: string }).code }, "prisma error");
    return;
  }
  log.error({ err: error, ...context }, "database error");
}

export function logAuthFailure(
  log: pino.Logger,
  reason: string,
  context: Record<string, unknown> = {},
) {
  log.warn({ event: "auth_failure", reason, ...context }, "authentication failed");
}
