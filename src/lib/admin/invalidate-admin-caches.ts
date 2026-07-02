import { clearAdminDataHealthSignalsCache } from "@/lib/admin/load-admin-data-health-signals";
import { clearAdminLeaguesListCache } from "@/lib/admin/load-admin-leagues-list";
import { clearAdminOpsPageCache } from "@/lib/admin/load-admin-ops-page-data";
import { clearAdminPlayerFilterContextCache } from "@/lib/admin/load-admin-player-filter-context";
import { clearAdminSubmissionQueueCache } from "@/lib/admin/load-admin-submission-queue";
import { clearManagedPlayerListPageCache } from "@/lib/admin/load-managed-player-list";
import { clearManagedTeamsCache } from "@/lib/admin/load-managed-teams";
import { clearProgramListCache } from "@/lib/admin/load-program-list";

/** School/program filter dropdown options on /admin/players. */
export function invalidateAdminPlayerFilterCaches() {
  clearAdminPlayerFilterContextCache();
}

/** Teams activity bundle and assembled /admin/teams list. */
export function invalidateAdminTeamsCaches() {
  clearManagedTeamsCache();
}

/** /admin/submissions queue tab list data. */
export function invalidateAdminSubmissionQueueCaches() {
  clearAdminSubmissionQueueCache();
}

/** /admin/leagues list rows. */
export function invalidateAdminLeaguesListCaches() {
  clearAdminLeaguesListCache();
}

/** /admin/ops signal counts and recent audit log rows. */
export function invalidateAdminOpsPageCaches() {
  clearAdminOpsPageCache();
}

/** /admin/data-health remediation queue counts. */
export function invalidateAdminDataHealthCaches() {
  clearAdminDataHealthSignalsCache();
}

/** Player bio fields that affect list rows and remediation counts. */
export function invalidateAdminPlayerProfileCaches() {
  clearManagedPlayerListPageCache();
  invalidateAdminPlayerFilterCaches();
  invalidateAdminDataHealthCaches();
  invalidateAdminOpsPageCaches();
}

/** Program metadata or player membership changes (no new game evidence). */
export function invalidateAdminProgramMembershipCaches() {
  clearProgramListCache();
  clearManagedPlayerListPageCache();
  invalidateAdminPlayerFilterCaches();
  invalidateAdminDataHealthCaches();
  invalidateAdminOpsPageCaches();
}

/** Submission queue or status changes without imported game evidence. */
export function invalidateAdminSubmissionListCaches() {
  invalidateAdminSubmissionQueueCaches();
  invalidateAdminOpsPageCaches();
}

/** Game imports, roster moves, league evidence edits, and derived rating refreshes. */
export function invalidateAdminEvidenceCaches() {
  invalidateAdminTeamsCaches();
  clearProgramListCache();
  clearManagedPlayerListPageCache();
  invalidateAdminPlayerFilterCaches();
  invalidateAdminSubmissionListCaches();
  invalidateAdminLeaguesListCaches();
  invalidateAdminDataHealthCaches();
}
