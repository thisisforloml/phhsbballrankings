import "server-only";

import pino from "pino";
import pinoPretty from "pino-pretty";

const isProduction = process.env.NODE_ENV === "production";

const pinoOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  base: {
    service: "peach-basket",
  },
  redact: {
    paths: ["password", "passwordHash", "req.headers.authorization", "req.headers.cookie"],
    remove: true,
  },
};

// Dev: synchronous pino-pretty in the main thread (no thread-stream worker).
// Worker transport breaks under Next.js instrumentationHook webpack bundling.
export const logger = isProduction
  ? pino(pinoOptions)
  : pino(
      pinoOptions,
      pinoPretty({
        colorize: true,
        translateTime: "SYS:standard",
      }),
    );

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
