import "server-only";

import { childLogger, logger, newAdminActionId, newRequestId } from "@/lib/logger";

export const SLOW_QUERY_THRESHOLD_MS = Number.parseInt(
  process.env.SLOW_QUERY_THRESHOLD_MS ?? "500",
  10,
);

export function monitoringLogger(bindings: Record<string, unknown> = {}) {
  return childLogger({ component: "monitoring", ...bindings });
}

export function logSlowQuery(context: {
  model?: string;
  operation: string;
  durationMs: number;
  requestId?: string;
}) {
  if (context.durationMs < SLOW_QUERY_THRESHOLD_MS) return;
  monitoringLogger({ requestId: context.requestId }).warn(
    {
      event: "slow_query",
      model: context.model ?? null,
      operation: context.operation,
      durationMs: context.durationMs,
      thresholdMs: SLOW_QUERY_THRESHOLD_MS,
    },
    "slow database query",
  );
}

export function logServerActionFailure(
  action: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  const adminActionId = newAdminActionId();
  monitoringLogger({ adminActionId, action }).error(
    { event: "server_action_failure", err: error, ...context },
    "server action failed",
  );
  return adminActionId;
}

export function logServerActionSuccess(
  action: string,
  durationMs: number,
  context: Record<string, unknown> = {},
) {
  monitoringLogger({ action }).info(
    { event: "server_action_success", durationMs, ...context },
    "server action completed",
  );
}

export function logUploadFailure(
  kind: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  monitoringLogger({ uploadKind: kind }).error(
    { event: "upload_failure", err: error, ...context },
    "file upload failed",
  );
}

export function logGlobalError(error: Error, context: Record<string, unknown> = {}) {
  logger.error(
    {
      event: "global_error",
      err: error,
      digest: "digest" in error ? (error as Error & { digest?: string }).digest : undefined,
      ...context,
    },
    "unhandled application error",
  );
}

export function ensureRequestId(existing?: string | null): string {
  return existing?.trim() || newRequestId();
}
