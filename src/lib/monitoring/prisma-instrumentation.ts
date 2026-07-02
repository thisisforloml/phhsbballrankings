import { PrismaClient } from "@prisma/client";

export function instrumentPrismaClient(base: PrismaClient) {
  return base.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        const start = Date.now();
        const run = async () => {
          try {
            return await query(args);
          } catch (error) {
            if (typeof window === "undefined") {
              const [{ logPrismaError }, { monitoringLogger }] = await Promise.all([
                import("@/lib/logger"),
                import("@/lib/monitoring/events"),
              ]);
              logPrismaError(monitoringLogger({ model, operation }), error, {
                event: "prisma_query_error",
              });
            }
            throw error;
          }
        };

        return run().then((result) => {
          const durationMs = Date.now() - start;
          if (typeof window === "undefined") {
            void import("@/lib/monitoring/events").then(({ logSlowQuery }) => {
              logSlowQuery({
                model: model ?? undefined,
                operation,
                durationMs,
              });
            });
          }
          return result;
        });
      },
    },
  });
}

export type InstrumentedPrismaClient = ReturnType<typeof instrumentPrismaClient>;

export function isPrismaClient(value: unknown): value is PrismaClient {
  return value instanceof PrismaClient;
}
