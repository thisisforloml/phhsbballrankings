import { inferSeasonName, inferSeasonYear, normalizeLeagueName } from "@/lib/stats-import/adapters/statshub-v1/infer-metadata";
import type { SubmissionGameDraft, SubmissionPackageDraft } from "@/lib/stats-import/types";

export function buildSubmissionPackageDraft(options: {
  leagueName: string;
  ageGroup: string;
  gender: "BOYS" | "GIRLS";
  seasonName?: string;
  seasonYear?: number;
  city?: string;
  region?: string;
  sourceUrl: string;
  competitionId?: string | null;
  games: SubmissionGameDraft[];
}): SubmissionPackageDraft {
  const seasonYear = options.seasonYear ?? inferSeasonYear(options.leagueName);
  const leagueName = normalizeLeagueName(options.leagueName);

  return {
    league: {
      name: leagueName,
      ageGroup: options.ageGroup,
      gender: options.gender,
      organizerName: leagueName.split(/\s+/)[0] ?? "StatsHub",
      city: options.city ?? "Metro Manila",
      region: options.region ?? "NCR"
    },
    season: {
      name: options.seasonName ?? inferSeasonName(options.leagueName, seasonYear),
      seasonYear
    },
    games: options.games,
    _provenance: {
      provider: "statshub-v1",
      sourceUrls: [options.sourceUrl],
      importedAt: new Date().toISOString(),
      externalCompetitionId: options.competitionId ?? undefined
    }
  };
}

export function packageDraftToRawText(packageDraft: SubmissionPackageDraft): string {
  const { _provenance, ...payload } = packageDraft;
  void _provenance;
  return JSON.stringify(payload, null, 2);
}
