import { TeamRankingSnapshotStatus } from "@prisma/client";

export class TeamSnapshotImmutabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamSnapshotImmutabilityError";
  }
}

export function assertTeamSnapshotMutable(status: TeamRankingSnapshotStatus) {
  if (status === TeamRankingSnapshotStatus.PUBLISHED) {
    throw new TeamSnapshotImmutabilityError("Published team ranking snapshots are immutable.");
  }
}

export function canRewriteTeamSnapshot(status: TeamRankingSnapshotStatus) {
  return status === TeamRankingSnapshotStatus.DRAFT;
}
