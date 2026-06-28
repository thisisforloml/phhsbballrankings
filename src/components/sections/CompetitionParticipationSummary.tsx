import { COMPETITION_PARTICIPATION_FOOTNOTE, COMPETITION_STRENGTH_DISCLAIMER } from "@/lib/competition-strength-copy";
import type { CompetitionParticipationSummary } from "@/lib/player-competition-context";
import { formatPrimaryCompetitionLine } from "@/lib/player-competition-context";
import { ProfileModule } from "@/components/public/ProfileModule";

export function CompetitionParticipationSummary({
  summary
}: {
  summary: CompetitionParticipationSummary;
}) {
  if (!summary.totalVerifiedGames) {
    return (
      <ProfileModule title="Competition Participation">
        <p className="text-sm text-court-600">No verified competition games on record yet.</p>
      </ProfileModule>
    );
  }

  return (
    <ProfileModule
      title="Competition Participation"
      action={
        <span className="text-xs font-bold text-court-500">
          {summary.competitionCount} competition{summary.competitionCount === 1 ? "" : "s"} · {summary.totalVerifiedGames} verified games
        </span>
      }
    >
      {summary.primary ? (
        <div className="border border-line-500 bg-paper-500 px-3 py-2">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-court-500">Primary verified competition</p>
          <p className="mt-1 font-display text-lg font-bold text-court-900">{summary.primary.leagueName}</p>
          <p className="mt-0.5 text-sm font-semibold text-court-600">
            {summary.primary.seasonName} · {formatPrimaryCompetitionLine(summary.primary)}
          </p>
        </div>
      ) : null}

      {summary.competitions.length > 1 ? (
        <ul className="mt-3 grid gap-2">
          {summary.competitions.slice(0, 5).map((entry) => (
            <li
              key={`${entry.leagueName}-${entry.seasonName}`}
              className="flex items-center justify-between gap-3 border border-line-500 bg-white px-3 py-2 text-sm"
            >
              <span className="min-w-0">
                <strong className="block truncate font-semibold text-court-900">{entry.leagueName}</strong>
                <span className="block text-xs text-court-500">{entry.seasonName}</span>
              </span>
              <span className="shrink-0 text-xs font-bold text-court-600">{entry.verifiedGames} gp</span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 text-xs leading-5 text-court-500">
        {COMPETITION_STRENGTH_DISCLAIMER} {COMPETITION_PARTICIPATION_FOOTNOTE}
      </p>
    </ProfileModule>
  );
}
