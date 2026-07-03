let handlingFatalError = false;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logger } = await import("@/lib/logger");
    const { logGlobalError } = await import("@/lib/monitoring/events");

    const reportFatalError = (error: Error, source: "unhandledRejection" | "uncaughtException") => {
      if (handlingFatalError) {
        console.error(`[fatal] recursive error while handling ${source}:`, error);
        return;
      }

      handlingFatalError = true;
      try {
        logGlobalError(error, { source });
      } finally {
        handlingFatalError = false;
      }
    };

    process.on("unhandledRejection", (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      reportFatalError(error, "unhandledRejection");
    });

    process.on("uncaughtException", (error) => {
      reportFatalError(error, "uncaughtException");
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
