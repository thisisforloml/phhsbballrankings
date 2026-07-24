import { revalidatePath } from "next/cache";

/**
 * Refresh public route and data caches after admin writes affecting rankings, games,
 * player ratings, or homepage statistics.
 */
export function revalidatePublicRankingSurfaces() {
  revalidatePath("/");
  revalidatePath("/rankings");
  revalidatePath("/teams");
  revalidatePath("/search");
  revalidatePath("/games");
  revalidatePath("/leagues");
}
