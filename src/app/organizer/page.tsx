import type { Metadata } from "next";
import { OrganizerRegistry } from "@/components/organizer-registry";
import { getPlayerSummaries } from "@/lib/players";

export const metadata: Metadata = {
  title: "Organizer Portal",
  description: "Organizer workflow for finding persistent players and submitting official verified game stats."
};

export default async function OrganizerPage() {
  const players = await getPlayerSummaries();

  return (
    <main className="section page-shell">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Restricted organizer workflow</p>
          <h1>Organizer portal</h1>
        </div>
        <p>
          Approved organizers log in, search the national player registry, and submit official game
          stats for verification before they affect ratings.
        </p>
      </div>
      <OrganizerRegistry players={players} />
    </main>
  );
}
