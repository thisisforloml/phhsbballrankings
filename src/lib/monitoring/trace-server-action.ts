import "server-only";

import { newAdminActionId } from "@/lib/logger";
import {
  logServerActionFailure,
  logServerActionSuccess,
  monitoringLogger,
} from "@/lib/monitoring/events";
import { getRequestIdFromHeaders } from "@/lib/request-context";
/**
 * Lightweight wrapper for Server Actions — logs duration, request correlation, and failures.
 */
export async function traceServerAction<T>(
  actionName: string,
  run: () => Promise<T>,
  context: Record<string, unknown> = {},
): Promise<T> {
  const requestId = getRequestIdFromHeaders();
  const adminActionId = newAdminActionId();
  const log = monitoringLogger({ requestId, adminActionId, action: actionName });
  const start = Date.now();

  try {
    const result = await run();
    logServerActionSuccess(actionName, Date.now() - start, {
      requestId,
      adminActionId,
      ...context,
    });
    return result;
  } catch (error) {
    logServerActionFailure(actionName, error, { requestId, adminActionId, ...context });
    log.error({ err: error }, "server action failure");
    throw error;
  }
}
