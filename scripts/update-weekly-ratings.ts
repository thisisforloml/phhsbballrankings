import { runWeeklyRatingsUpdate } from "../src/lib/weekly-ratings";
import { prisma } from "../src/lib/prisma";

runWeeklyRatingsUpdate()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
