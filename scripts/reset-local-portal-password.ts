import { createHash } from "node:crypto";
import { prisma } from "../src/lib/prisma";

const temporaryPassword = "ChangeMe123!";

function passwordHash(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      role: {
        in: ["ADMIN", "ORGANIZER"]
      }
    },
    orderBy: [
      { role: "asc" },
      { createdAt: "asc" }
    ],
    select: {
      id: true,
      username: true,
      email: true,
      role: true
    }
  });

  if (!user) {
    throw new Error("No active ADMIN or ORGANIZER user found.");
  }

  await prisma.user.update({
    where: {
      id: user.id
    },
    data: {
      passwordHash: passwordHash(temporaryPassword)
    }
  });

  console.log(JSON.stringify({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    confirmation: "Portal password reset to temporary development password."
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });