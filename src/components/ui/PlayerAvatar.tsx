import Image from "next/image";

import type { Player } from "@/lib/mock-data";

const sizes = {
  sm: "h-10 w-10 text-xl",
  md: "h-16 w-16 text-3xl",
  lg: "h-28 w-28 text-stat-md"
};

export function PlayerAvatar({ player, size = "md" }: { player: Player; size?: keyof typeof sizes }) {
  const initials = `${player.firstName[0]}${player.lastName[0]}`;

  if (player.photoUrl) {
    return (
      <span className={`${sizes[size]} relative block overflow-hidden rounded-full border border-amber-500 bg-white`}>
        <Image src={player.photoUrl} alt={`${player.firstName} ${player.lastName}`} fill className="object-cover" unoptimized />
      </span>
    );
  }

  return (
    <span className={`${sizes[size]} inline-grid place-items-center rounded-full border border-amber-500 bg-navy-50 font-display font-extrabold text-navy-800`}>
      {initials}
    </span>
  );
}
