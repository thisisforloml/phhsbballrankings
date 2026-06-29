# Admin Operations Runbook

## Demo prep (no mutations)

- Do **not** run imports, repairs, rating recomputes, or Formula v2 writes
- Browser smoke: `/admin`, `/admin/submissions`, one submission detail, `/admin/programs/[id]`
- Confirm publish buttons show impact summary and confirmations

## Production publish

1. Open submission in Inbox → review parsed games and validation
2. Resolve team/player identity warnings
3. Read **pre-publish impact summary** (games, stats, ratings recompute flag)
4. Confirm checkboxes for guided publish
5. After publish: spot-check public `/rankings`, affected player profiles, `/teams`
6. Run validation scripts only when explicitly requested:
   - `npx.cmd tsc --noEmit`
   - `npx.cmd tsx scripts/validate-ratings-v1.ts`
   - `npx.cmd tsx scripts/validate-ranking-snapshots-v1.ts`

## Monthly identity cleanup cadence

Run dry-run planners only until scope approved:

```powershell
npm.cmd run plan:canonicalize-legacy-teams
npm.cmd run plan:roster-only-canonicalization
npm.cmd run plan:retire-generic-teams
npm.cmd run cleanup:zero-reference-legacy-teams:dry-run
```

Blocked roster backlog: 23 rows (15 `BLOCKED_NO_VALID_TARGET`, 8 `BLOCKED_CROSS_SEASON`). Track decisions in Data Health console.

## Intake channels

| Channel | Path | Status |
| --- | --- | --- |
| JSON | Submission upload | Supported |
| Excel/CSV | Submission upload + re-parse | Supported |
| Manual | Live Capture | Supported |
| URL | Admin tools URL import | Supported; merge into inbox UX over time |

## Guardrails

- Never rewrite `GameStat.teamId` / `Game.homeTeamId` / `Game.awayTeamId` on normal transfer
- Team-to-Program reassignment updates only `Team.programId`
- Migrations, merges, deletes, snapshot generation require explicit approval
