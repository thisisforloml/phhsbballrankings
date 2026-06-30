import { revalidatePath } from "next/cache";

/**
 * Bust ISR / Full Route Cache for public routes driven by rankings, games,
 * player ratings, and homepage statistics.
 */
export function revalidatePublicRankingSurfaces() {
  revalidatePath("/");
  revalidatePath("/rankings");
  revalidatePath("/teams");
  revalidatePath("/search");
  revalidatePath("/games");
  revalidatePath("/leagues");
}
