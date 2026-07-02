export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logger } = await import("@/lib/logger");
    const { logGlobalError } = await import("@/lib/monitoring/events");

    process.on("unhandledRejection", (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      logGlobalError(error, { source: "unhandledRejection" });
    });

    process.on("uncaughtException", (error) => {
      logGlobalError(error, { source: "uncaughtException" });
    });

    logger.info(
      {
        event: "instrumentation_registered",
        runtime: process.env.NEXT_RUNTIME,
        nodeEnv: process.env.NODE_ENV,
      },
      "monitoring instrumentation ready",
    );
  }
}
