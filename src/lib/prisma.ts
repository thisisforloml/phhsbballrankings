import { Prisma, PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaFingerprint?: string;
};

function prismaSchemaFingerprint() {
  return Object.keys(Prisma.PlayerScalarFieldEnum).sort().join(",");
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function hasRequiredDelegates(client: PrismaClient) {
  const extended = client as PrismaClient & {
    teamExternalAlias?: { findMany?: unknown };
    playerExternalAlias?: { findMany?: unknown };
  };
  return Boolean(
    extended.teamExternalAlias &&
      typeof extended.teamExternalAlias.findMany === "function" &&
      extended.playerExternalAlias &&
      typeof extended.playerExternalAlias.findMany === "function"
  );
}

function getPrismaClient() {
  const fingerprint = prismaSchemaFingerprint();
  const cached = globalForPrisma.prisma;
  const cacheMatchesSchema = globalForPrisma.prismaSchemaFingerprint === fingerprint;

  if (cached && cacheMatchesSchema && hasRequiredDelegates(cached)) {
    return cached;
  }

  if (cached) {
    void cached.$disconnect();
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaSchemaFingerprint = fingerprint;
  return client;
}

export const prisma = getPrismaClient();
