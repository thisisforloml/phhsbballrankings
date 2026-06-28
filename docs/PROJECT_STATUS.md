# Project Status and Guardrails

Last updated: 2026-05-18

## Stable Database Counts

Latest stable post-cleanup counts:

| Table | Count |
| --- | ---: |
| Player | 216 |
| Active Game | 76 |
| Active GameStat | 1885 |
| GamePerformanceScore | 1885 |
| PlayerRating | 181 |
| RankingSnapshot | 2 |
| RankingSnapshotRow | 138 |
| League | 2 |
| Season | 2 |

Non-validated old/test games were soft-deleted. The active public dataset now matches the 76 validated UAAP Season 88 games. Do not restore or count non-validated games unless explicitly reviewing archived/test data.

Latest player bio coverage counts:

| Field | Count |
| --- | ---: |
| playersWithNonNullPosition | 95 |
| playersWithNonNullHeightCm | 102 |
| playersWithNonNullBirthDate | 85 |
| playersWithNonNullPhotoUrl | 0 |

## Official Age Groups

Current official age groups:

- U13: age 13 and below
- U16: ages 14-16
- U19: ages 17-19

Age-group brackets use **calendar age as of the evaluation date** (birthday-based), not a March 31 season lock. Graduation still follows the class-year rule on June 1 of the class year. High school datasets with unknown birth year default to U19 until player bio data is completed and recalculation rules are approved.

Rating carryover planning:

- Players do not reset to zero when advancing age groups.
- Players should receive a carryover baseline rating based on previous age-group performance.
- Carryover rating should be discounted because the next age group is more competitive.
- Carryover should fade as the player records verified games in the new age group.
- Formula v1 does not implement carryover yet; this is a planned rating policy.
- Current ratings still come from verified game data in the player's current age group.

## Class Year Planning

Current planned class-year rule:

- Class year is the year when the player turns 19 on or before March 31.
- January-March birth month: classYear = birthYear + 19.
- April-December birth month: classYear = birthYear + 20.
- Born March 2007 = Class of 2026.
- Born April 2007 = Class of 2027.
- Born June 2006 = Class of 2026.

Ranking eligibility planning:

- Athletes remain ranking-eligible through May 31 of their class year.
- Starting June 1 of their class year, they should be removed from active rankings.
- Unknown birthDate remains eligible for now but should be flagged as missing age/class data.
- This exclusion rule is now enforced when generating public RankingSnapshot rows. PlayerRating remains available for players with stats.

## Formula v1 Star Bands

Formula v1 uses fixed star bands based on adjustedRating:

| Rating | Star Rating |
| --- | ---: |
| < 60 | 1 star |
| 60-69 | 2 stars |
| 70-79 | 3 stars |
| 80-89 | 4 stars |
| 90-100 | 5 stars |

## Public Eligibility

Current launch-stage public ranking eligibility:

- U19 Boys: 10+ verified games
- U19 Girls: 5+ verified games

PlayerRating can exist below public eligibility. RankingSnapshot rows should include only public-eligible players.

## Completed Features

- UAAP Season 88 HS Boys and Girls batch JSON validation.
- Database import for games, players, and game stats (historical bootstrap; GameStat batch loaders archived under `scripts/archive/uaap-s88/`).
- Formula v1 methodology document.
- Formula v1 GamePerformanceScore computation for validated imported rows only.
- Formula v1 PlayerRating computation using U19 age group.
- Formula v1 U19 national RankingSnapshot generation for Boys and Girls.
- Duplicate player diagnostic, approved merge plan, merge execution, source JSON canonicalization, and cleanup audit.
- Real database-backed `/rankings` page.
- Real database-backed `/players/[slug]` profile pages.
- Admin player bio editor.
- Server-side signed-cookie portal authentication.
- Admin Portal and Organizer Portal route separation.
- Player bio editor safety audit script.

## Latest UI Checkpoint

- Admin-side player photo cropper is implemented in Program Detail and Player Management flows.
- Cropper exports normalized 2:3 portrait images at 1000 x 1500 px through the existing `photoFile` / `photoUrl` upload path.
- PNG transparency is preserved for PNG exports.
- Public player profile hero now trusts normalized 2:3 crops and no longer uses aggressive overscaling.
- Player profile image renders with `object-contain object-bottom` inside the orange panel.
- Player profile metadata row spacing was stabilized with fixed/max grid columns to avoid inconsistent spacing across laptop vs wider monitor widths.
- Player Rankings renders player photos as 2:3 portrait thumbnails using `row.player.photoUrl`.
- Rankings presentation changed from a square `object-cover` avatar to a portrait `object-contain object-bottom` thumbnail.
- No-photo rankings state remains supported with initials.
- No schema, ranking, or data logic changes were made.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Remaining QA:

- Re-upload/crop Jude's image after the public CSS fix.
- Test player profile on laptop and wider monitor/TV.
- Test Player Rankings thumbnail.
- Test no-photo profile and no-photo rankings row.
- Test mobile player profile and mobile rankings.

## Latest Importer Checkpoint

- Multi-format spreadsheet parser now skips non-game/helper/report sheets instead of treating them as failed game sheets.
- Skip rules include sheet names such as legend, readme, instructions, template, report, projection(s), summary, dashboard, index, and notes.
- Content-based skipping was added for sheets without likely game/stat structure.
- Valid game sheets still parse normally.
- Malformed sheets that look like game sheets still produce sheet-specific errors.
- If no valid game sheets are found, the importer still shows the helpful supported-format error.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Remaining QA:

- Upload PYBC workbook with Legend/Report/Projection sheets.
- Confirm non-game sheets are skipped.
- Confirm valid game sheets parse.
- Confirm workbook with no game sheets still errors clearly.

## Latest Submission Re-parse Checkpoint

- Added admin-only re-parse action for stored spreadsheet submissions.
- Existing uploaded spreadsheets can be reprocessed with the latest parser without re-uploading if `Submission.storedFilePath` is available.
- Re-parse is available only for stored `UPLOAD_CSV` / `UPLOAD_XLSX` submissions before `IMPORTED`.
- Admin confirmation is required.
- Re-parse reads the stored file and updates only `rawText`, `parsedPreview`, and `validationSummary`.
- It does not import, publish, create `Game` / `GameStat` records, recompute ratings, or generate snapshots.
- This supports reprocessing the existing PYBC 21-28 workbook so G25 can appear as a default/forfeit team-result-only game.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Remaining QA:

- Open existing PYBC 21-28 submission.
- Run Re-parse with latest parser.
- Confirm preview shows 8 games.
- Confirm G25 appears as Default / forfeit.
- Confirm G25 has no player stats.
- Confirm no official Games/GameStats are created.

## Latest Competition Naming Checkpoint

- Added shared competition naming normalization in `src/lib/competition-naming.ts`.
- PYBC naming variants now normalize to the preferred display/program name `PYBC 15U`:
  - `Philippine Youth Basketball Championship - 15U`
  - `PYBC U16 Boys Basketball`
  - `PYBC 15U`
- PYBC age group parsing remains separate, so U16 age-group logic is preserved where needed.
- PYBC is now treated as boys competition context.
- NCAA juniors variants continue to infer/display as boys competition context.
- Normalization is wired into spreadsheet parsing/review flows where safe.
- No database writes, imports, publish, schema, ranking, or rating logic changes were made.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Remaining QA:

- Upload PYBC workbook.
- Confirm preview/review displays `PYBC 15U`.
- Confirm age group still parses safely.
- Confirm PYBC boys context is not missing.
- Confirm NCAA juniors still shows boys context.
- Confirm no import/publish occurs automatically.

## Latest Spreadsheet Team Display Checkpoint

- Spreadsheet team display names were cleaned up in `src/lib/submission-utils.ts`.
- Uploaded team names now preserve casing, trim whitespace, normalize repeated spaces, and strip `16U` / `16 U` suffixes.
- Team display names are no longer forced to ALL CAPS.
- Age group/gender context such as `U16 Boys` is not appended to submitted/public team display names.
- Internal Team matching may still use age/gender context through existing internal naming logic.
- Admin submission preflight messaging now clarifies the difference between submitted/public display names and internal Team match names.
- Spreadsheet uploads remain submission previews/drafts and do not appear in Program Management until official import/publish.
- No database writes, imports, publish, schema, ranking, or rating logic changes were made.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Remaining QA:

- Upload PYBC workbook.
- Confirm PYBC displays as `PYBC 15U`.
- Confirm team names preserve uploaded casing.
- Confirm `U16 Boys` is not appended to public/submitted display names.
- Confirm age group/gender context is still available for review/preflight.
- Confirm Program Management remains unchanged before official import/publish.

## Latest PYBC Program Linking Checkpoint

- Official spreadsheet import flow now resolves a Program during Team creation/reuse.
- PYBC imports keep `PYBC 15U` as the normalized league/competition name, not as the Program.
- Future approved PYBC imports will create/reuse one Program per uploaded PYBC team/program and link each Team to its own Program.
- Reused Teams are linked only if `programId` is null.
- Existing non-null `programId` values are not overwritten.
- Internal Team matching names like `TEAM NAME U16 Boys` are preserved for matching.
- Added `scripts/backfill-pybc-team-programs.ts`.
- Backfill script defaults to dry-run.
- PYBC Program-link repair was executed successfully.
- Correct model is now enforced:
  - `PYBC 15U` is league/competition context.
  - Each PYBC participating team is its own Program/team-program.
- Repair mode used: `repair_incorrect_pybc_program_links`.
- Execution result:
  - Programs created: 7.
  - Programs reused: 1.
  - Teams repaired: 8.
  - Teams linked via normal null-link path: 0.
- The repaired Teams were moved away from the incorrect `PYBC 15U` Program and into their own Program records.
- Protected counts remained unchanged:
  - Games.
  - GameStats.
  - GamePerformanceScores.
  - PlayerRatings.
  - RankingSnapshots.
  - RankingSnapshotRows.
- Validation passed.
- No deletes, merges, rating recomputes, or snapshot changes were performed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

## Latest PYBC Duplicate Team Repair Checkpoint

- Approved PYBC duplicate Team repair batch was executed.
- Scope was limited to 5 `READY_FOR_APPROVAL` participants:
  - JMTG Medical Trading Infinite.
  - Migrafix Doc Boleros.
  - Migueluz Trading Moderno.
  - Prime Ascencion Medical Supplies San Anton.
  - Smile 360 Bullies.
- Repair reassigned duplicate Team references to canonical clean Teams.
- Expected scope:
  - 5 duplicate Teams.
  - 26 games.
  - 313 GameStats.
- Repair updated only:
  - `Game.homeTeamId`.
  - `Game.awayTeamId`.
  - `GameStat.teamId`.
- Excluded and still unresolved:
  - LEV Construction Full Potential.
  - JPM-TEC San Beda / SBU.
  - San Pedro Spartans.
- No deletes, merges, player/stat value changes, rating recomputes, imports, publishes, or snapshot changes were intended.

Remaining QA:

- Confirm the 5 repaired Programs show clean active Team records.
- Confirm Team Rankings and Team Profiles still load.
- Leave unresolved cases for later manual review after usage reset.

## Final PYBC Identity Repair Checkpoint

- Final PYBC identity repair path was implemented and executed.
- Cases inspected: 2.
- Both cases were `EXECUTE_READY`:
  - San Pedro Spartans.
  - JPM-TEC San Beda / SBU.
- San Pedro canonical Program: `b5c79a29-bd7b-47ce-ac9c-4d15f1fbb711` / San Pedro Spartans.
- San Pedro canonical Team: `26ce5dc4-0667-4710-ab1b-53d4a13d8d61` / San Pedro Spartans.
- San Pedro reassigned:
  - San Pedro Spartans U16 Boys: `G-2025-011`, `G-2025-017`, `G-2025-021`, `G-2025-023`, `G-2025-028`; 56 GameStats.
  - SPARTANS U16 Boys: `G-2025-008`; 15 GameStats.
  - `Team.programId` moved to canonical San Pedro Program where needed.
- JPM-TEC San Beda canonical Program: `65908829-cfda-4053-821c-47435a45e33e` / JPM-TEC San Beda.
- JPM-TEC San Beda canonical Team: `8af1de8f-7e66-436b-9e2e-6c22d9add869` / JPM-TEC San Beda.
- JPM/SBU reassigned:
  - SBU U16 Boys: `G-2025-016`, `G-2025-019`, `G-2025-021`, `G-2025-022`, `G-2025-027`; 69 GameStats.
- Total execution result:
  - San Pedro: 6 games updated, 71 GameStats updated, 1 `Team.programId` updated.
  - JPM-TEC/SBU: 5 games updated, 69 GameStats updated.
- Protected counts remained unchanged:
  - Games: 291.
  - GameStats: 6720.
  - GamePerformanceScores: 6100.
  - PlayerRatings: 611.
  - RankingSnapshots: 3.
  - RankingSnapshotRows: 511.
- Validation passed.
- No deletes, merges, imports, publishes, rating recomputes, snapshot changes, player changes, or stat-value changes were performed.
- Only intended `Team.programId`, `Game.homeTeamId`, `Game.awayTeamId`, and `GameStat.teamId` updates ran.

Final QA:

- Refresh Admin Program Management.
- Confirm all 8 PYBC participant Programs appear cleanly:
  - JMTG Medical Trading Infinite.
  - LEV Construction Full Potential.
  - Migrafix Doc Boleros.
  - Migueluz Trading Moderno.
  - Prime Ascencion Medical Supplies San Anton.
  - JPM-TEC San Beda.
  - Smile 360 Bullies.
  - San Pedro Spartans.
- Confirm `PYBC 15U` remains league/competition context, not a Program.
- Confirm Team Rankings and Team Profiles load.
- Then continue uploading remaining PYBC games.

## PYBC Team Rankings Scope Checkpoint

- Public Team Rankings / Team Standings use the full competition view.
- Team Rankings should count all active official Game rows in the selected competition/scope.
- PYBC 15U full competition expected games: 37.
- PYBC 15U elimination / round-robin expected games: 28.
- The 7-game-per-team check applies only to elimination / round-robin validation, not the public full-competition Team Rankings view.
- Playoff, classification, and final games should not be excluded from public Team Rankings.
- PYBC games `G-2025-029` through `G-2025-037` should remain active and count in full PYBC rankings.
- Default / forfeit game `G-2025-025` counts as a team result even though it has no player GameStats.
- Current Team Rankings logic reads active official Game rows directly and does not require GameStats, so team-result-only games are eligible.
- No database writes, imports, repairs, rating recomputes, snapshot changes, or formula changes were made for this clarification.

## Latest PYBC Import Team Resolution and Duplicate Repair Checkpoint

- Fixed future official import Team resolution for club/team Programs.
- Import now prefers a same-Program cleaned display-name Team before exact internal suffix Team names.
- This prevents old `U16 Boys` internal Team records from winning over canonical clean Team records during future PYBC imports.
- Added and executed the guarded latest PYBC duplicate Team repair.
- Dry-run inspected 8 cases and marked all 8 `EXECUTE_READY`.
- Repair included all 8 PYBC participant Programs:
  - JMTG Medical Trading Infinite.
  - JPM-TEC San Beda.
  - LEV Construction Full Potential.
  - Migrafix Doc Boleros.
  - Migueluz Trading Moderno.
  - Prime Ascencion Medical Supplies San Anton.
  - San Pedro Spartans.
  - Smile 360 Bullies.
- Execution updated:
  - `Game.homeTeamId`: 9 refs.
  - `Game.awayTeamId`: 9 refs.
  - `GameStat.teamId`: 240 rows.
- Protected counts remained unchanged:
  - Games: 300.
  - GameStats: 6960.
  - GamePerformanceScores: 6340.
  - PlayerRatings: 611.
  - RankingSnapshots: 3.
  - RankingSnapshotRows: 511.
- Validation passed.
- Post-repair audit shows all 8 PYBC participant Programs now have one active PYBC Team each.
- Old suffix/internal Teams now have 0 active PYBC Games and 0 active PYBC GameStats.
- No schema changes, migrations, imports/publish, deletes, rating recomputes, snapshot generation, player changes, stat-value changes, or non-PYBC repairs were performed.

Remaining QA:

- Refresh Admin Program Management.
- Confirm all 8 PYBC Programs show one active Team and no `NEEDS REVIEW` from active duplicates.
- Confirm Team Rankings loads and reflects all 37 PYBC games.
- Confirm Team Profiles load.
- Confirm future PYBC uploads do not reactivate suffix/internal Team duplicates.

## Final PYBC Team Rankings Grouping Checkpoint

- Public Team Rankings finalization completed.
- Root cause was raw grouping by `leagueId` + `seasonId` + `teamId`, while PYBC records had normalized competition variants across stored league/season records.
- PYBC Team Rankings now group/display under normalized `PYBC 15U`.
- PYBC uses `Full Competition` season label.
- PYBC grouping uses Program identity when available, preventing raw/internal suffix Team IDs from splitting public rows.
- Active PYBC games counted: 37.
- Grouped PYBC teams: 8.
- Team appearances: 74.
- Duplicate suffix rows: 0.
- `G-2025-025` default/forfeit game is counted as a team result despite 0 GameStats.
- Final PYBC records:
  - San Pedro Spartans: 8-4, PF 952, PA 820, Diff +132.
  - Prime Ascencion Medical Supplies San Anton: 6-3, PF 677, PA 575, Diff +102.
  - Smile 360 Bullies: 6-3, PF 593, PA 569, Diff +24.
  - Migrafix Doc Boleros: 6-4, PF 794, PA 718, Diff +76.
  - JPM-TEC San Beda: 5-4, PF 710, PA 651, Diff +59.
  - LEV Construction Full Potential: 3-5, PF 513, PA 527, Diff -14.
  - JMTG Medical Trading Infinite: 3-5, PF 551, PA 674, Diff -123.
  - Migueluz Trading Moderno: 0-9, PF 562, PA 818, Diff -256.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Manual QA:

- `/teams` shows 8 PYBC teams.
- No `U16 Boys` duplicate rows.
- `PYBC 15U` remains league/competition context.
- Full competition records reflect all 37 games.

## Player Profile League History Normalization Checkpoint

- Player Profile League History now normalizes PYBC competition variants into one display entry.
- Variants collapsed into `PYBC 15U`:
  - `PYBC 15U`.
  - `Philippine Youth Basketball Championship - 15U`.
  - `PYBC U16 Boys Basketball`.
- PYBC League History uses `Full Competition` season label.
- League History aggregation now normalizes before grouping, so games, points, assists, and rebounds are combined before PPG/APG/RPG are calculated.
- Non-PYBC League History entries keep their existing raw league/season grouping.
- Read-only validation found 115 players with multiple raw PYBC League History entries that now collapse to one `PYBC 15U` entry.
- No database writes, imports, repairs, schema changes, rating recomputes, snapshot generation, deletes, or merges were performed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Manual QA:

- Open an affected athlete profile.
- Confirm only one `PYBC 15U` League History entry appears.
- Confirm PYBC games/stats are combined.
- Confirm non-PYBC leagues still display normally.

## Public Rank Consistency Checkpoint

- Public rank consistency validation is complete.
- Player Rankings and Player Profile rank cards now match across tested boards.
- Boys U19 and Girls U19 were checked and confirmed correct.
- Eli Dulot profile now matches Player Rankings rank.
- Missing/unknown position ranks display compactly as `—`.
- No additional ranking logic changes are needed right now.

Next QA areas:

- Final public UI pass.
- Admin Program Management spot-check.
- Team Rankings / Team Profiles spot-check.
- Continue normal data uploads only through preview/review flow.

## Public Player Ranking Scope Audit Checkpoint

- Public player ranking scope audit completed.
- League-specific public player rankings are not currently present in the MVP rankings flow.
- Public Player Rankings use national age-group snapshots:
  - `scope: NATIONAL`.
  - `ageGroup: U13 / U16 / U19`.
  - `gender: BOYS / GIRLS`.
  - No `leagueId`.
  - No `seasonId`.
  - No competition filter.
- Player Profile rank cards use the same current public board lookup, so profile ranks are national age-group ranks.
- PYBC is stored with standard `ageGroup: U16`.
- `15U` is competition display/naming context, not a separate age group.
- Latest U16 Boys national snapshot includes all 129 PYBC distinct players.
- PYBC can still appear separately in Team Rankings, League Directory, League Detail, Player Profile League History, reports, and audits as competition context.
- No immediate MVP code fix is required.
- Future audit needed: rating-generation aggregation should be checked before Formula v2 production to confirm ratings aggregate correctly across active age-group competitions.

## Current Stable Checkpoint

- PYBC identity cleanup is complete.
- `PYBC 15U` is league/competition context, not a Program.
- The 8 canonical PYBC participant Programs are:
  - JMTG Medical Trading Infinite.
  - LEV Construction Full Potential.
  - Migrafix Doc Boleros.
  - Migueluz Trading Moderno.
  - Prime Ascencion Medical Supplies San Anton.
  - JPM-TEC San Beda.
  - Smile 360 Bullies.
  - San Pedro Spartans.
- Future imports prefer same-Program clean Team records before old `U16 Boys` / internal suffix Teams.
- Team Rankings uses the full-competition view.
- PYBC Team Rankings groups 37 games into 8 clean teams.
- `G-2025-025` default/forfeit counts as a team result with no player stats.
- Player Profile League History normalizes PYBC variants into one `PYBC 15U` / `Full Competition` entry.
- Player Rankings and Player Profile ranks are consistent across tested boards, including Boys U19 and Girls U19.
- Default/forfeit spreadsheet sheets are supported.
- Admin re-parse for stored spreadsheet submissions exists.
- Admin Team-to-Program assignment exists.
- No additional ranking logic changes are needed right now.

Final QA checklist:

- Public pages: `/`, `/rankings`, `/teams`, `/leagues`, `/players/[sample]`, `/teams/[sample]`, `/methodology`.
- Admin pages: `/admin/programs`, `/admin/submissions`, `/admin/tools/submissions`, `/admin/tools/live-stats`.
- PYBC Programs show cleanly.
- No duplicate `U16 Boys` public rows.
- Team Rankings shows 8 PYBC rows.
- Player profile ranks match Player Rankings.
- League History shows one `PYBC 15U` row.
- Mobile view.

## Public MVP Player Analytics Checkpoint

- Premium Access is deferred for the current public MVP.
- Public player profiles now show available full analytics without a Premium Access gate.
- `PremiumGate` remains in the codebase for future use after the business model is defined.
- Player profiles now expose public box-score analytics where source data exists:
  - Full current-age-group averages.
  - Shooting profile.
  - Advanced Metrics based only on available box-score inputs.
  - Game highs.
  - Recent 5-game averages when enough games exist.
  - Full game-by-game stat log.
  - Ranking trend when real ranking snapshot history exists.
- Advanced metrics must be calculated honestly from available box-score data.
- `eFG%`, `TS%`, `AST/TO`, points per minute, rebounds per minute, stocks, and Peach Basket Box Efficiency are allowed as box-score estimates when inputs exist.
- Official-style `ORTG`, `DRTG`, `BPM`, Win Shares, PER, on/off, and usage rate should not be shown as official metrics unless the required inputs/model exist.
- Default/forfeit games remain team results only and do not create player stat rows.
- No database writes, imports, schema changes, rating formula changes, rating recomputes, or snapshot generation were performed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Remaining QA:

- Player profile with many PYBC games.
- Player profile with missing height/position.
- Player profile with no game logs.
- Mobile player profile.
- Confirm no Premium Access gate appears publicly.

## Public Player Profile UI Polish Checkpoint

- Public player profile layout was polished after analytics were made public.
- Layout order is now:
  1. Player hero/header.
  2. Recent Games.
  3. Player Analytics overview.
  4. Shooting Profile + Role Indicators.
  5. Advanced Metrics + Game Highs.
  6. League History.
  7. Ranking Trend.
  8. Full Game Log.
  9. Rating explanation.
  10. Compact Claim Profile CTA.
- Oversized section headers were replaced with compact profile-specific headings.
- Vertical spacing was tightened.
- Recent Games is now a compact latest-5 preview.
- League History cards are shorter and easier to scan.
- Analytics are split into clearer scouting-style panels.
- Stat cards are more compact and consistent.
- Claim Profile CTA moved near the bottom.
- Full Game Log uses horizontal scroll with reduced row height and sticky date column where useful.
- Mobile sections stack cleanly.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Manual QA:

- Jude Eriobu profile.
- Eli Dulot profile or player with missing metadata.
- PYBC player with many games.
- Player with few/no games.
- Mobile player profile.
- Full game log horizontal scroll.

## Compact Public Player Profile Styling Checkpoint

- Compact public player profile styling pass completed.
- Added shared `ProfileModule` wrapper in `src/components/public/ProfileModule.tsx`.
- Player profile sections now use bordered white profile modules with tighter padding, smaller headings, and subtle card shadows.
- Reduced section spacing to compact `gap-5` / `md:gap-6`.
- Replaced large section headings with `text-2xl` / `text-3xl` module headings.
- Recent Games rows, header, grid columns, and padding were tightened.
- League History cards are shorter with smaller titles and tighter stat columns.
- Player Analytics stat cards are denser with smaller values, reduced padding, and tighter gaps.
- Shooting Profile, Advanced Metrics, Role Indicators, and Game Highs panels are more compact.
- Full Game Log is contained inside a module with horizontal scroll, narrower min-width, smaller rows, and reduced stat typography.
- Claim Profile CTA is smaller and less dominant near the bottom.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Manual QA:

- Hard refresh `/players/jude-eriobu`.
- Check heading sizes below hero.
- Check analytics compactness.
- Check Full Game Log containment and horizontal scroll.
- Check mobile player profile layout.

## Player Profile Value Improvements Checkpoint

- Phase 1 public player profile value improvements completed.
- Recent Form was upgraded from a basic latest-games block to a rule-based latest-five form summary.
- Recent Form uses only actual latest official game stat rows.
- Recent Form shows latest-five PPG/RPG/APG and Peach Basket Box Efficiency when at least three recent games exist.
- Recent Form compares latest-five scoring and box efficiency against full current-age-group profile averages.
- Recent Form labels are transparent and rule-based:
  - `Heating Up`: latest-five scoring is at least +2 PPG above full average, or latest-five box efficiency is at least +2 above full average.
  - `Cooling`: latest-five scoring is at least -2 PPG below full average, or latest-five box efficiency is at least -2 below full average.
  - `Steady`: latest-five production is close to the full-profile baseline.
  - `Limited Sample`: fewer than three recent official stat rows.
- Competition History was improved while preserving PYBC normalization into `PYBC 15U` / `Full Competition`.
- Competition History now includes a summary line for tracked competitions and official games.
- Competition entries now show competition name, season label, games, PPG/RPG/APG, box-efficiency average, tier label, and a simple production marker.
- A dedicated Best Game card was added.
- Best Game is selected by highest Peach Basket Box Efficiency, with points as the tie-breaker.
- Best Game shows opponent, competition, game/date context, PTS/REB/AST/STL/BLK, shooting line, and box efficiency.
- Empty states remain clean when game data is missing.
- All labels and cards are rule-based from real box-score stats only.
- No fake scouting notes, subjective AI evaluations, rating formula changes, ranking formula changes, database writes, imports, rating recomputes, or snapshot generation were performed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Manual QA:

- Player with many PYBC games.
- Player with fewer than three games.
- Player with one competition.
- Player with multiple competitions.
- Mobile player profile.

## Phase 2 Player Intelligence Checkpoint

- Phase 2 public Player Intelligence features were added to player profiles.
- Added a compact `Player Intelligence` module in `src/components/public/PlayerAnalytics.tsx`.
- Added primary Role Archetype, Strength Badges, and Percentile Profile data in `src/lib/player-profile.ts`.
- Percentile Profile compares only within the same age group and gender on the current public board.
- Percentile categories:
  - Scoring: PPG percentile.
  - Efficiency: Peach Basket Box Efficiency percentile.
  - Rebounding: RPG percentile.
  - Playmaking: APG percentile.
  - Defense: steals plus blocks per game percentile.
  - Sample: official stat-row/game-count percentile.
- Percentiles require a comparison pool of at least 8 current public-board players; otherwise the UI shows limited comparison data.
- Primary Role Archetype is rule-based:
  - `Limited Sample`: fewer than 3 official stat rows.
  - `All-Around Contributor`: 3 or more categories at or above the 60th percentile.
  - `Primary Scorer`: scoring at or above the 75th percentile.
  - `Efficient Finisher`: box-efficiency at or above the 75th percentile.
  - `Playmaker`: assists at or above the 75th percentile.
  - `Glass Cleaner`: rebounds at or above the 75th percentile.
  - `Defensive Disruptor`: steals plus blocks at or above the 75th percentile.
  - `Developing Contributor`: fallback based on strongest available category.
- Strength Badges are rule-based and capped at 5:
  - Top Scorer: top-20% scoring profile or 15+ PPG.
  - Efficient Producer: top-20% Peach Basket Box Efficiency profile.
  - Strong Rebounder: top-20% rebounding profile or 7+ RPG.
  - Playmaker: top-20% assist profile or 4+ APG.
  - Defensive Activity: top-20% stocks profile or 2+ steals/blocks per game.
  - Reliable Sample: top-20% sample size or 10+ official stat rows.
- No fake scouting notes or subjective AI evaluations were added.
- No database writes, imports, schema changes, admin/import logic changes, rating formula changes, ranking formula changes, rating recomputes, or snapshot generation were performed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Manual QA:

- High-scoring player.
- Efficient low-volume player.
- Rebounder/defender.
- Player with limited games.
- Missing metadata player.
- Mobile player profile.

## Phase 3 Player Intelligence Checkpoint

- Phase 3 Player Intelligence completed.
- Shooting Profile now uses compact horizontal bars.
- Metrics show only when valid inputs exist:
  - FG% requires FGA.
  - 2P% requires 2PA.
  - 3P% requires 3PA.
  - FT% requires FTA.
  - eFG% requires FGA.
  - TS% requires FGA or FTA inputs.
- Missing attempts are hidden gracefully.
- Full Game Log now has client-side controls:
  - Competition filter.
  - Result filter.
  - Sort by date, PTS, REB, AST, STL, BLK, box efficiency.
- Game Log keeps all existing columns and horizontal scroll.
- No new server queries or data logic changes.
- TypeScript passed with `npx.cmd tsc --noEmit`.
- No formula/rating/admin/import changes.

Manual QA:

- Player with full shooting stats.
- Player with missing attempts.
- PYBC player with many games.
- Player with one competition.
- Player with multiple competitions.
- Mobile game log filters.

## Whole-Site MVP QA Audit Checkpoint

- Whole-site MVP QA audit completed after PYBC cleanup, Team Rankings finalization, Player Profile Intelligence phases, and public rank consistency fixes.
- Public route files confirmed for:
  - `/`.
  - `/rankings`.
  - `/teams`.
  - `/leagues`.
  - `/how-we-rank`.
  - `/methodology`.
  - `/players/[slug]`.
  - `/teams/[id]`.
  - `/games/[id]`.
- Admin route files confirmed for:
  - `/admin/programs`.
  - `/admin/submissions`.
  - `/admin/tools/submissions`.
  - `/admin/tools/live-stats`.
- Player profile implementation confirmed:
  - Hero/header uses `PlayerProfileHeader`.
  - Rank cards use the current public board lookup.
  - Recent Form, Player Intelligence, percentile bars, Shooting/Efficiency bars, Best Game, League History, Ranking Trend, and Filterable Full Game Log are wired into `/players/[slug]`.
  - Player Analytics date formatting uses UTC for deterministic rendering.
- Team Rankings implementation confirmed:
  - `/teams` uses `dynamic = "force-dynamic"` and `revalidate = 0`.
  - Team standings read active official Game rows directly.
  - PYBC grouping normalizes to `PYBC 15U` / `Full Competition`.
  - PYBC grouping uses Program identity where available to prevent old `U16 Boys` suffix Team IDs from splitting public rows.
  - Default/forfeit team-result-only games count through Game rows and do not require GameStats.
- Import/submission implementation confirmed:
  - Spreadsheet parser supports old two-team-section sheets.
  - Spreadsheet parser supports combined Player Stats tables.
  - Multi-sheet workbooks skip helper/report sheets.
  - Default/forfeit team-result-only sheets are represented with `defaultWin` / `teamResultOnly`.
  - Stored spreadsheet re-parse action exists and updates preview data only.
- Formula/rating status confirmed:
  - Public profile/rankings still use Formula v1/current production paths.
  - Formula v2 remains preview/design only.
  - Package scripts include `ratings:v2:preview` and `ratings:v2:dry-run`.
  - No Formula v2 execute path is exposed under the current schema.
- TypeScript passed with `npx.cmd tsc --noEmit`.
- No code changes, database writes, imports/publish, repairs, rating recomputes, snapshot generation, schema changes, migrations, deletes, merges, or formula changes were performed during this QA audit.

Recommended final pre-demo checks:

- Browser-check `/`, `/rankings`, `/teams`, `/leagues`, `/how-we-rank`, one player profile, and one team profile on desktop and mobile.
- Spot-check a PYBC player profile with many games for Recent Form, Player Intelligence, Shooting Bars, Best Game, League History, and Game Log filters.
- Spot-check `/teams` with PYBC selected to confirm 8 clean rows and no `U16 Boys` duplicate public rows.
- Spot-check Admin Program Management and Admin Submissions to confirm expected access/copy.

## Public Auth MVP Copy Cleanup Checkpoint

- Remaining public auth-page Premium Access wording was removed or neutralized for MVP demo consistency.
- `/login` copy now says `Access your Peach Basket account`.
- `/login` helper copy now references submitting stats, managing submissions, and reviewing official basketball data.
- `/login` registration CTA now says `Create an Peach Basket account`.
- `/register` headline now says `Create an Peach Basket account`.
- `/register` step labels now use `Account`, `Workspace`, and `Role`.
- `/register` visible package/payment language was replaced with neutral workspace/account language:
  - Submit Stats.
  - Manage Profiles.
  - Review Data.
  - Organizer / Coach / Program Staff / Scout / Analyst role options.
- Development-only error copy now references Peach Basket accounts instead of premium accounts.
- Authentication behavior was not intentionally changed.
- No database writes, schema changes, imports/publish, rating changes, admin/import logic changes, or Formula changes were performed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Manual QA:

- `/login`.
- `/register`.
- Navbar `Submit Stats` flow.

## Public Content Pages MVP Draft Checkpoint

- Public content pages were drafted/updated for MVP demo readiness.
- Privacy Policy was expanded at `/privacy`.
- Terms of Use was expanded at `/terms`.
- How We Rank / Methodology was updated at `/how-we-rank`; `/methodology` continues to mirror the same page.
- About Us was rebuilt at `/about` with mission, vision, platform overview, audience list, founder profile, and a note that Peach Basket supports but does not replace coaches/scouts.
- Footer Platform links now include:
  - About.
  - Leagues.
  - How We Rank.
  - Privacy Policy.
  - Terms of Use.
- Privacy Policy and Terms of Use remain working drafts for lawyer/privacy review before full public launch.
- How We Rank explains data sources, ranking philosophy, age groups, ratings, eligibility, team rankings, star bands, corrections, and Formula versioning without exposing the full proprietary rating formula, internal constants, or formula code.
- About page includes:
  - Mission: make Philippine youth basketball more visible, measurable, and accessible through official game statistics and credible player/team profiles.
  - Vision: become the trusted national data layer for Philippine youth basketball.
  - Founder profile for Darwin Joseph F. Santos.
- No database writes, imports/publish, schema changes, admin/import logic changes, rating formula changes, ranking formula changes, rating recomputes, or snapshot generation were performed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Manual QA:

- `/privacy`.
- `/terms`.
- `/how-we-rank`.
- `/methodology`.
- `/about`.
- Footer links.
- Mobile readability.

## Public Content Page Styling Follow-up Checkpoint

- Public content page typography was adjusted for a more polished legal/about/methodology presentation.
- Shared `SectionHeader` now supports a compact `content` variant while preserving the existing display-scale default for other public pages.
- About, How We Rank, Privacy Policy, and Terms of Use now avoid oversized display-style headers.
- About page founder profile was removed for now.
- About mission was updated to: `To identify the best youth basketball talent in the Philippines through objective, data-based rankings while giving Filipino athletes greater visibility and exposure.`
- About vision was updated to: `To become the trusted national platform for Philippine youth basketball visibility, where players from every region can be discovered, compared, and recognized through credible game data.`
- Footer contrast was improved with a darker navy background, brighter body text, stronger link color, and preserved gold hover states.
- Admin UI polish remains a separate future task and was intentionally not changed in this pass.
- No database writes, imports/publish, schema changes, admin/import logic changes, rating formula changes, ranking formula changes, rating recomputes, or snapshot generation were performed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Manual QA:

- `/about`.
- `/privacy`.
- `/terms`.
- `/how-we-rank`.
- `/methodology`.
- Footer desktop/mobile contrast.

## Admin UI MVP Demo Audit Checkpoint

- Admin UI audit completed as read-only inspection.
- Routes/files inspected:
  - `/admin` via `src/app/admin/page.tsx`.
  - `/admin/programs` via `src/app/admin/programs/page.tsx` and `src/app/admin/programs/ProgramListClient.tsx`.
  - `/admin/programs/[id]` via `src/app/admin/programs/[id]/page.tsx` and `src/app/admin/programs/[id]/ProgramDetailClient.tsx`.
  - `/admin/submissions` via `src/app/admin/submissions/page.tsx`.
  - `/admin/submissions/[id]` via `src/app/admin/submissions/[id]/page.tsx`, `SimplifiedSubmissionReview.tsx`, and admin submission actions.
  - `/admin/tools/submissions` via `src/app/admin/tools/submissions/page.tsx`.
  - `/admin/tools/live-stats` via `src/app/admin/tools/live-stats/page.tsx` and shared `LiveStatsClient`.
  - Admin navigation via `src/components/admin/AdminSidebar.tsx`.
- Audit findings:
  - `P0 blocker`: none found from code inspection. Existing import, re-parse, Program assignment, and draft-edit workflows have meaningful server-side guardrails.
  - `P1 before demo`: Submission detail page is too dense and exposes multiple publish/import/processing paths in one long page. The guided review, advanced details, import preflight, import/publish audit, draft JSON, and post-import processing sections need clearer hierarchy and safer progressive disclosure.
  - `P1 before demo`: Publish/process actions need stronger visual separation and confirmation language. `Publish` can run approval, import, Formula v1 scores, ratings, monthly rankings, and validation; this is accurate but high-impact and should feel more deliberate in the UI.
  - `P1 before demo`: Program Management detail pages are powerful but crowded. Team-to-Program assignment has confirmation and good safety copy, but edit Program, edit Team/Moniker, player bio editing, player photo upload, current Program editing, and transfer history all compete visually.
  - `P1 before demo`: Manual Stats Entry uses a very wide stat table (`min-w-[106rem]`) and can feel spreadsheet-heavy on laptop/tablet. It is functional but should be split into a calmer scorekeeper workflow for demos.
  - `P1 before demo`: Admin Submission Tools and Organizer Submission upload pages duplicate layout/copy. Admin-owned tools correctly stay under `/admin/tools`, but they should look more explicitly like admin draft creation rather than organizer-facing intake.
  - `P2 later polish`: Admin dashboard is already focused on primary workflows and utilities, but card typography still uses large stat-style headings. It can be tightened after the major submission/program pages.
  - `P2 later polish`: Program list table/card hybrid is readable on desktop, but mobile/tablet density and status explanations (`Needs review`, `High team count`) need more explanatory inline help.
  - `P2 later polish`: Sidebar navigation is functional, but active states and grouping could better distinguish primary workflows from dangerous/advanced utilities.
- Workflow clarity notes:
  - Program Management correctly explains that Program is school/club/team-program identity and league/competition is separate.
  - Team-to-Program reassignment requires a checkbox confirming it only changes `Team.programId` and does not modify games, stats, ratings, snapshots, merge teams, or delete records.
  - Stored spreadsheet re-parse requires confirmation and updates only draft preview JSON/counts before import.
  - Default/forfeit games are shown as `Default / forfeit` and state that no player stats are included and player ratings should not be affected.
  - Imported submissions are locked from draft edit/re-parse in the UI.
- Safety/guardrail notes:
  - No broad repair/execute scripts are exposed in the admin UI.
  - No database deletes/merges are exposed in the inspected pages.
  - Import and publish copy is mostly accurate, but demo UX should make write impact and sequence more obvious before action.
- Top 5 recommended Admin UI fixes before MVP demo:
  1. Rebuild `/admin/submissions/[id]` into a step-based review flow: Summary, Validation, Preflight, Draft Edits, Import/Publish, Audit.
  2. Add explicit confirmation UI for high-impact publish/process actions, especially any action that computes ratings or generates snapshots.
  3. Compact Program detail into tabs or accordions: Program Info, Teams/Monikers, Players, Transfers/Assignments, Photo/Profile Fields.
  4. Improve Manual Stats Entry for demo use with sticky team/player columns, smaller inputs, clearer section progression, and better laptop/tablet behavior.
  5. Standardize admin page headers, card spacing, button hierarchy, status badges, and helper copy across dashboard, programs, submissions, and tools.
- What should not be touched yet:
  - Formula v2 execution/storage remains blocked by schema design and should not be exposed in admin.
  - Repair/backfill execution scripts should remain CLI/dry-run-first and not become casual admin buttons.
  - Import/publish/data mutation behavior should not be redesigned until the submission detail UI is clarified.
  - Public UI and ranking/rating formulas should remain separate from this admin polish track.
- No code changes, database writes, imports/publish, repairs, schema changes, migrations, rating recomputes, snapshot generation, deletes, merges, or formula changes were performed.

## Admin Submission Detail Step Flow Checkpoint

- `/admin/submissions/[id]` was reorganized into a clearer step-based review flow for MVP demos.
- Existing backend import/publish/re-parse/edit actions were not changed.
- New visible structure:
  1. Submission Overview.
  2. Parsed Games Preview.
  3. Validation & Warnings.
  4. Editable Review / Advanced Draft JSON Edit.
  5. Safe Admin Actions.
  6. Final Publish / Import.
- Re-parse stored spreadsheet action now appears inside the review flow under Safe Admin Actions.
- Final publish is visually separated in a red high-impact zone.
- Final publish copy now states that the guided action may:
  - Mark the submission under review/approved.
  - Create official League/Season/Team/Player/Game/GameStat records.
  - Compute Formula v1 scores.
  - Update PlayerRatings.
  - Generate monthly rankings.
  - Run validation and revalidate public views.
- UI confirmation checkboxes were added for high-impact actions:
  - Guided final publish.
  - Import Official Data.
  - Process & Publish Rankings.
  - Individual Formula v1 score computation.
  - Individual PlayerRating computation.
  - Individual monthly ranking generation.
- Default/forfeit team-result-only preview remains visible and still explains that no player stat rows are included and player ratings should not be affected.
- Dense game/stat tables remain horizontally scrollable and functional.
- No imports/publish were run during this task.
- No database writes, schema changes, migrations, rating recomputes, snapshot generation, deletes, merges, formula changes, public UI changes, or repair/backfill actions were performed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Manual QA:

- Pending submission.
- Imported submission.
- Spreadsheet upload submission.
- Default/forfeit submission.
- Re-parse action UI.
- Final publish/import action UI.

## Admin Program Detail Workspace Checkpoint

- `/admin/programs/[id]` was organized into a clearer step-based workspace for MVP demos.
- Existing backend Program, Team, player, photo, and assignment actions were not changed.
- New visible structure:
  1. Program Overview.
  2. Current Teams / Monikers.
  3. Assign Team to Program.
  4. Players.
  5. Unassigned / Program-level Players when present.
  6. Advanced / Admin Notes.
- Team-to-Program assignment was separated from routine Team/Moniker editing and moved into its own warning-toned section.
- Assignment guardrail copy remains explicit: the action updates only `Team.programId` and does not move games, change GameStats, edit players, recompute ratings, generate snapshots, merge records, or delete anything.
- PYBC model was reiterated in the UI: `PYBC 15U` is league/competition context, not a Program, and remains excluded from Program assignment targets.
- Player profile, media/photo, current Program, and transfer tools remain available inside each player row.
- Advanced/Admin Notes remain read-only diagnostics; no repair/backfill execute buttons were added.
- No database writes, backend action changes, schema changes, imports/publish, rating recomputes, snapshot generation, deletes, merges, rating formula changes, ranking formula changes, or public UI changes were performed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Manual QA:

- PYBC participant Program, such as San Pedro Spartans or Smile 360 Bullies.
- School Program.
- Program with multiple Teams.
- Team assignment UI.
- Player edit/photo tools.

## Public Brand-System Tightening Checkpoint

- Public UI brand-system tightening pass completed for MVP demo direction.
- Shared public components were tightened:
  - `SectionHeader` now uses smaller, sharper content headings and shorter description spacing.
  - `ProfileModule` now uses denser module headings, tighter padding, and subtler sports-card shadows.
  - `FilterBar` controls are shorter and more compact.
  - `Navbar` height, logo scale, nav copy, and account button copy were tightened.
  - `Footer` branding and spacing were reduced for a cleaner sports-media footer.
- Homepage copy was reduced and repositioned around concise sports-platform surfaces:
  - Player Rankings.
  - Team Rankings.
  - Player Profiles.
  - Ranking Basis.
  - Submit Stats.
- Ranking tables and Team Ranking tables now use a more consistent sports-table treatment:
  - compact black table headers.
  - shorter rows.
  - tighter rank typography.
  - stronger portrait thumbnail treatment.
- Public content pages were tightened:
  - About masthead shortened.
  - How We Rank masthead shortened.
  - supporting cards use denser copy and shared sports-module styling.
- Player Profile UI was tightened:
  - hero card spacing and stat cards reduced.
  - Recent Form copy shortened.
  - Player Intelligence role explanation and percentile labels shortened.
  - Full Game Log rows and headers made more compact.
- Team Profile UI was tightened:
  - hero card spacing reduced.
  - roster table uses compact sports-table treatment.
- No data/query logic, database writes, admin/import logic, rating/ranking formulas, recomputes, snapshots, schema changes, deletes, or merges were performed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Recommended next design work:

- Create a single public page masthead component and replace one-off hero implementations.
- Build a reusable sports table primitive for rankings, roster, team rankings, game logs, and recent games.
- Audit all public copy and remove remaining explanatory text from non-legal pages.
- Add visual assets/editorial imagery later so homepage and content pages feel less abstract.
- Separate public sports-media styling from admin workflow styling more strictly.

## Homepage MVP Demo Readiness Checkpoint

- Homepage/platform messaging was updated for MVP demo readiness.
- Hero copy now positions Peach Basket as a basketball player visibility and rankings platform.
- Primary homepage CTA now points to Player Rankings.
- Secondary homepage CTAs point to Team Rankings and methodology.
- Added clearer public messaging for:
  - Players and parents.
  - Coaches and scouts.
  - Organizers and leagues.
  - Official/statistical box-score basis for rankings.
  - Player profile analytics now available publicly.
  - Team Rankings using full competition records.
  - Organizer stat/box-score submission through review flow.
- Added a current MVP coverage block using existing public counts.
- Premium Access messaging remains removed/deferred for MVP.
- Public nav unauthenticated organizer CTA now says `Submit Stats`.
- No data, ranking, rating, import, admin, schema, or database logic changes were made.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Manual QA:

- Homepage desktop.
- Homepage mobile.
- CTA links to `/rankings`, `/teams`, `/how-we-rank`, and `/portal/login`.
- Confirm no Premium Access promo appears.
- Confirm methodology link works.

## Formula v2 Decision Checkpoint

- `Claude No Shrinkage` is the approved Formula v2 candidate for future implementation, pending a guarded implementation/recompute plan.
- Formula v2 candidate:
  - Possession-informed raw game value.
  - Missed FG/FT costs included.
  - Rebounds, assists, steals, blocks, turnovers, fouls, and fouls drawn valued from league PPP/context where available.
  - No plus-minus in the main formula.
  - Percentile-scaled game performance.
  - Recency-weighted player average:
    - Last 2 weeks = `1.00`.
    - Last month = `0.80`.
    - Older = `0.60`.
  - No Bayesian shrinkage for now.
  - Advanced Bonus disabled.
  - League weight, opponent factor, and team context remain neutral at `1.00` in v2.
  - Future `GamePerformanceScore` rows should use `formulaVersionTag = 2` when implemented.
- Why:
  - Bayesian shrinkage compressed scores too aggressively.
  - `Claude No Shrinkage` restored elite players to the 85-95+ range.
  - Existing star bands remain usable.
  - Ranking order improvements from possession-informed scoring were preserved.
- Remaining concern:
  - Low-game volatility.
- Mitigation:
  - Public leaderboard eligibility/minimum games and provisional labels, not shrinkage.
- No production ratings were changed.
- No recomputes or snapshots were run.
- Before implementation, rating-generation aggregation should be audited to confirm ratings aggregate correctly across active age-group competitions.

## Formula v2 Preview / Write-Plan Checkpoint

- Formula v2 preview path was implemented as read-only.
- Preview command:
  - `npm.cmd run ratings:v2:preview`.
- Preview reports:
  - `scripts/reports/formula-v2-preview.md`.
  - `scripts/reports/formula-v2-preview.json`.
- Preview summary:
  - Official active games with player stats: 253.
  - Official active GameStats included: 6,340.
  - Players with stats: 601.
  - League/season scaling pools: 5.
  - Missing-input warnings: none.
- Formula v2 preview confirmed:
  - Top scores are in the expected 85-98 range.
  - Default/forfeit games with no player stat rows do not affect player Formula v2 inputs.
  - No `LeagueSeasonAverage`, `GamePerformanceScore`, `PlayerRating`, `RankingSnapshot`, `Game`, or `GameStat` rows were written.
  - No public leaderboard output changed.
- Added shared Formula v2 helper math in `src/lib/advanced-metrics.ts`.
- Added guarded write-readiness dry-run:
  - `npm.cmd run ratings:v2:dry-run`.
  - Report outputs:
    - `scripts/reports/formula-v2-write-plan.md`.
    - `scripts/reports/formula-v2-write-plan.json`.
- Formula v2 execute is intentionally not available under the current schema.
- Storage blocker:
  - `GamePerformanceScore.gameStatId` is globally unique, so v2 rows cannot be inserted beside v1 rows for the same GameStat.
  - `PlayerRating` is unique on `[playerId, ageGroup]` and has no formula version field, so v2 ratings cannot coexist with production v1 ratings.
- Safe write strategy before implementation:
  - Approve a storage design first, either versioning `GamePerformanceScore` and `PlayerRating` by formula, or adding dedicated Formula v2 shadow/preview tables.
  - Then implement an execute script that writes only v2 records, leaves `formulaVersionTag = 1` rows untouched, validates preview counts, and still does not generate snapshots.
  - Generate v2 RankingSnapshots and switch public leaderboard output only in a later separately approved step.
- No database writes, imports/publish, production rating recomputes, ranking snapshots, schema changes, deletes, merges, or public formula changes were performed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

## Formula v2 Storage Design Proposal

- Formula v2 versioned-rating storage design was reviewed but not implemented.
- Files/references inspected:
  - `prisma/schema.prisma`.
  - `src/lib/submission-post-import-processing.ts`.
  - `src/lib/rankings.ts`.
  - `scripts/preview-formula-v2.ts`.
  - `scripts/reports/formula-v2-preview.md`.
  - `scripts/reports/formula-v2-write-plan.md`.
- Current relevant model state:
  - `FormulaVersion` already exists and is referenced by `GamePerformanceScore` and `RankingSnapshot`.
  - `GamePerformanceScore` has `formulaVersionId` and `formulaVersionTag`, but `gameStatId` is globally unique.
  - `PlayerRating` has no `formulaVersionId` / `formulaVersionTag` and is unique on `[playerId, ageGroup]`.
  - `RankingSnapshot` already has `formulaVersionId`, so snapshots can be generated separately by formula version after ratings storage is safe.
  - `RankingSnapshotRow` is tied to a snapshot and does not need its own formula version field.
  - `LeagueSeasonAverage` is unique by `seasonId`; if Formula v2 stores league-context averages later, this table also needs formula versioning or a separate v2 context table.
- Options considered:
  - Option A: Version existing constraints.
    - Change `GamePerformanceScore` uniqueness from global `gameStatId @unique` to a composite uniqueness such as `[gameStatId, formulaVersionId]`.
    - Add `formulaVersionId` to `PlayerRating` and change uniqueness to `[playerId, ageGroup, formulaVersionId]`.
    - Optionally add `formulaVersionId` to `LeagueSeasonAverage` and change uniqueness to `[seasonId, formulaVersionId]` if averages will be persisted.
    - Pros: aligns with existing `FormulaVersion` and `RankingSnapshot` architecture; cleaner long-term production model.
    - Risks: all live reads of `PlayerRating` must filter the active public formula version before v2 rows are inserted, or public/profile/admin code may see duplicate ratings.
  - Option B: Create Formula v2 shadow tables.
    - Example tables: `FormulaV2GamePerformanceScore`, `FormulaV2PlayerRating`, and optionally `FormulaV2LeagueSeasonAverage`.
    - Pros: safest for validation because v1 production tables and existing reads are untouched.
    - Risks: duplicates schema and recompute logic; eventual public switch requires another migration/refactor to avoid permanent parallel systems.
  - Option C: Version `PlayerRating` and rely on already-versioned `RankingSnapshot`.
    - This fixes ratings/snapshots but is incomplete unless `GamePerformanceScore` uniqueness is also versioned or v2 scores are stored elsewhere.
- Recommended strategy:
  - Use Option A as the long-term schema direction, implemented as a guarded two-phase migration.
  - Phase 1 should add formula-version support while keeping public Formula v1 behavior explicit:
    - Add `formulaVersionId` to `PlayerRating`.
    - Backfill existing `PlayerRating` rows to Formula v1.
    - Replace `@@unique([playerId, ageGroup])` with `@@unique([playerId, ageGroup, formulaVersionId])`.
    - Change `GamePerformanceScore` from `gameStatId @unique` to `@@unique([gameStatId, formulaVersionId])`.
    - Keep `formulaVersionTag` as a denormalized/debug label only; `formulaVersionId` should be the authoritative version key.
    - Update every production read path to filter the active public formula version before any v2 ratings are written.
  - Phase 2 should compute v2 side-by-side:
    - Create or reuse `FormulaVersion` v2 with `isPublic = false`.
    - Write v2 `GamePerformanceScore` rows using `formulaVersionId = v2` and `formulaVersionTag = 2`.
    - Write v2 `PlayerRating` rows using `formulaVersionId = v2`.
    - Do not generate public snapshots in the same step.
  - Phase 3 should validate and switch only after approval:
    - Generate v2 `RankingSnapshot` rows with `formulaVersionId = v2`.
    - Compare v1 vs v2 snapshots and rank movements.
    - Switch public leaderboard/profile rank lookup to v2 only after explicit approval.
- Why this is safer:
  - v1 score/rating rows remain intact.
  - v2 can be recomputed side-by-side and discarded if needed.
  - `RankingSnapshot` already supports formula-specific public boards.
  - Rollback can simply point public reads back to Formula v1 snapshots/ratings while leaving v2 rows non-public.
- Migration risks:
  - Adding non-null `formulaVersionId` to existing `PlayerRating` requires a careful backfill to Formula v1.
  - Dropping `GamePerformanceScore.gameStatId @unique` and replacing it with a composite unique must be done carefully to avoid index/constraint drift.
  - Any read path that assumes one `PlayerRating` per player/age group must be updated before v2 rows are inserted.
  - `player.currentRatings.find((rating) => rating.ageGroup === ageGroup)` style logic becomes unsafe unless filtered by public formula version.
  - If `LeagueSeasonAverage` remains unversioned, persisted averages cannot safely represent both v1 and v2 contexts.
- Rollback strategy:
  - Keep Formula v1 rows and snapshots untouched.
  - Keep Formula v2 `isPublic = false` until switch approval.
  - If validation fails, soft-delete or ignore v2 rows and continue using Formula v1.
  - If public switch has occurred, switch active public formula lookup back to Formula v1 and regenerate/repoint snapshots only through a separately approved rollback step.
- Future implementation sequence:
  1. Add schema migration for versioned `GamePerformanceScore` and `PlayerRating` storage.
  2. Backfill existing `PlayerRating.formulaVersionId` to Formula v1.
  3. Update all read paths to filter by active public formula version.
  4. Run `ratings:v2:preview` again.
  5. Run a guarded v2 dry-run that validates expected write counts.
  6. Execute v2 `GamePerformanceScore` writes only.
  7. Execute v2 `PlayerRating` writes only.
  8. Validate v1 counts unchanged and v2 counts match preview inputs.
  9. Generate v2 `RankingSnapshot` rows in a separate approved step.
  10. Compare v1 vs v2 boards.
  11. Switch public leaderboard/profile ranks to v2 only after approval.
- No schema changes, migrations, database writes, rating recomputes, snapshot generation, imports/publish, deletes, merges, or public leaderboard changes were performed.

## Supported Data Ingestion

Official submission import is the **only supported path** for new `Game` / `GameStat` evidence in production.

| Layer | Path |
| --- | --- |
| Admin workflow | Admin → Submissions → review → preflight → publish/import |
| Import implementation | `src/lib/submission-official-import.ts` |
| Preflight | `src/lib/submission-import-preflight.ts` |
| Player identity | `src/lib/player-import-identity.ts` (`PlayerAlias` resolution) |
| GameStat immutability | `src/lib/game-stat-import-integrity.ts` (create / skip / block) |

Legacy UAAP Season 88 batch GameStat import scripts were **archived** to `scripts/archive/uaap-s88/`. They perform upsert overwrites, do not use `PlayerAlias`, and do not enforce GameStat immutability. **Do not run in production.** See `scripts/archive/uaap-s88/README.md`.

## Intended Upload Resolution Flow

For any game-stat upload source - JSON, Excel, CSV, or manual input:

- Resolve Team first.
- Check whether the Team already exists in the database.
- If not existing, create the Team/profile during approved import.
- If the Team appears to exist under a different name, assign/link it under the correct Program.
- Example: the ADMU Program can contain ADMU Girls, ADMU U16, ADMU Juniors, and other context-specific internal Team records.
- After Team resolution, resolve Players:
  - Match existing players where possible.
  - Create player profiles only during approved import.
  - Attach GameStats to the resolved player, Team, and Game.
- League/competition context remains separate from Program.
- Example: `PYBC 15U` is league/competition context; San Pedro Spartans, Smile 360 Bullies, JPM-TEC San Beda, and similar participants are Programs/team-programs.

Admin Program Management now supports explicit Team-to-Program reassignment:

- The Team card shows the current Program and a target Program selector.
- Reassignment requires confirmation.
- The action updates only `Team.programId`.
- It does not modify games, GameStats, players, ratings, snapshots, merge teams, or delete records.

Remaining QA:

- Refresh Admin Program Management.
- Confirm these Programs appear:
  - JMTG Medical Trading Infinite.
  - LEV Construction Full Potential.
  - Migrafix Doc Boleros.
  - Migueluz Trading Moderno.
  - Prime Ascencion Medical Supplies San Anton.
  - SBU.
  - Smile 360 Bullies.
  - Spartans.
- Confirm `PYBC 15U` remains league/competition context, not the Program containing all teams.
- Confirm public Team Rankings/Team Profiles use cleaned display names.
- Then upload the rest of the PYBC games.

## Current Routes

Public routes:

- `/rankings`
- `/players/[slug]`

Admin routes:

- `/admin`
- `/admin/players`

Organizer routes:

- `/organizer`
- `/organizer/live-stats`

Portal auth routes:

- `/portal/login`
- `/portal/logout`

Legacy `/portal` routes should redirect to the appropriate Admin or Organizer destination based on authenticated role.

## Guardrails

- Never run migrations without explicit approval.
- Never change the rating formula without explicit approval.
- Never merge, hard-delete, or soft-delete players without explicit approval.
- Never recompute ratings or snapshots unless explicitly requested.
- Never run imports unless explicitly requested.
- Never modify schema unless explicitly requested.
- Treat PlayerRating as the current/latest rating record.
- Treat RankingSnapshot and RankingSnapshotRow as historical public ranking outputs.
- Keep organizer-facing tools limited to data submission workflows.
- Keep admin-only tools limited to internal Peach Basket team workflows.

## Standard Validation Commands

Run these only when appropriate and explicitly requested for the task:

```powershell
npx.cmd tsc --noEmit
npx.cmd tsx scripts/validate-ratings-v1.ts
npx.cmd tsx scripts/validate-ranking-snapshots-v1.ts
npx.cmd tsx scripts/audit-player-bio-editor-safety.ts
```

## Player Profile Density Checkpoint

- Public player profile density pass completed for a tighter sports recruiting/rankings profile feel.
- Reduced whitespace by tightening `ProfileModule` headers, body padding, shadows, and section spacing.
- Removed equal-height dashboard-style dead space in analytics by replacing broad two-column equal grids with independently stacked production columns.
- Player Intelligence is now a compact role + strength-badge strip with percentile bars below in a dense grid.
- Shooting Profile bars are shorter and use a compact two-column desktop grid when inputs exist.
- Role Indicators are no longer a separate oversized panel; role/badge context is consolidated into Player Intelligence.
- Best Game was reframed as a compact Signature Performance module.
- Advanced Metrics and Game Highs now use denser stat tiles/lists instead of tall panels.
- Recent Form, League History, rating explanation, and Claim Profile spacing were tightened.
- Full Game Log filters and horizontal-scroll table remain intact.
- No data/query changes, database writes, admin/import logic changes, rating formula changes, recomputes, snapshots, migrations, deletes, or merges were performed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

## Ranking/Profile Public Fix Checkpoint

- Game UID / internal game numbers are now internal-only for public UI.
- Public player profile game displays no longer show game numbers in:
  - Game Highs.
  - Signature Performance / Best Game.
  - Full Game Log.
- Public team profile recent game rows no longer show game numbers.
- Public game detail pages no longer show `Game number` metadata or include the game number in the page title.
- Admin, organizer, import, and submission review surfaces may still show game numbers where they are operationally useful.
- Player Rankings search/filter rank bug was fixed:
  - Search results no longer use filtered array index as the displayed rank.
  - Public rankings preserve the canonical current board rank for each player.
  - Player Rankings and Player Profile rank cards continue to share the same rank lookup path.
- End-of-May age progression/removal rule was added to the public ranking eligibility path:
  - U19 class-year removals apply after the end of May through the existing class-year exclusion rule.
  - Public age brackets use calendar age as of the evaluation date (birthday-based), not a March 31 season lock.
  - No players, ratings, stats, or snapshots were deleted or reset.
- Public ranking product direction was updated from monthly-refresh boards to live current boards:
  - Public Player Rankings now read current `PlayerRating` rows for the active public formula version.
  - Ranking snapshots remain historical/trend/audit records.
  - Player Profile rank cards use the same live board lookup.
  - Formula math was not changed.
- Remaining follow-up:
  - Import/publish copy still mentions monthly rankings in admin surfaces and should be updated in a separate admin copy pass.
  - Carryover baseline for age-group advancement remains a future guarded ratings task.
- No database writes, imports, schema changes, migrations, recomputes, snapshot generation, Formula v2 implementation, deletes, or merges were performed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

## Public UI Cleanup Checkpoint

- Public rank display now uses shared display formatting for player-facing rank surfaces.
- Ranks `#1` through `#100` display exactly.
- Ranks `#101` and beyond display as 50-player bands such as `#101-150`, `#151-200`, and `#201-250`.
- The rank display change is presentation-only and does not change ranking order, rating math, eligibility, snapshots, or stored data.
- Player profile rank cards, Player Rankings rows, homepage leaderboard preview, and player profile metadata now use the shared public rank formatter.
- Player profile Full Game Log matchup labels now use known program acronyms where available, such as compact `TEAM vs TEAM` matchup display, while unknown names fall back to their submitted display names.
- Public game detail hero team names were reduced and wrapped more safely so long team names do not dominate the page.
- Privacy Policy and Terms of Use pages were simplified into plain readable content layouts with fewer boxed sections.
- Footer was simplified to centered quick links only:
  - Rankings.
  - Teams.
  - Leagues.
  - About.
  - How We Rank.
  - Privacy Policy.
  - Terms of Use.
- Footer contact detail and phone number were removed from the bottom public layout.
- Admin copy density was spot-audited; remaining crowded/wordy admin surfaces should be handled in a separate admin copy pass to avoid changing workflow behavior during public UI cleanup.
- No database writes, imports, schema changes, migrations, recomputes, snapshot generation, formula changes, admin backend changes, deletes, or merges were performed.

## Manual QA Follow-up Fix Checkpoint

- Banded public rank display was tightened after manual QA.
- Exact ranks `#1` through `#100` remain visually strong.
- Ranks `#101` and beyond still display as 50-player bands, but band labels now use smaller typography and wider rank columns where needed so labels such as `#101-150` do not clip.
- Banded-rank display was applied consistently across:
  - Player Rankings table.
  - Search/filter rankings table.
  - Player Profile rank card.
  - Homepage leaderboard preview.
- Footer quick links remain centered and compact.
- Compact Connect links were restored for already-known footer targets:
  - Facebook.
  - WhatsApp.
  - Viber.
- Footer phone/contact paragraph and descriptive bottom copy remain removed.
- Program transfer workflow was audited.
- Root cause of the confusing transfer behavior:
  - `Player.currentProgramId` controls the player's current profile Program.
  - Program detail Team sections are built from historical active `GameStat.teamId` evidence under each Team/Moniker.
  - Moving a player current Program does not rewrite historical GameStats or assign the player to a target Team/Moniker.
  - Therefore a transferred player can still appear under the old Team history and appear as Program-level / unassigned in the target Program until a guarded roster/team assignment workflow exists.
- Admin Program detail copy now clarifies that current Program transfer is profile-program-only and does not rewrite games, stats, ratings, old Team/Moniker records, or snapshots.
- A future guarded transfer/roster workflow should support:
  - Moving the current Program.
  - Optionally assigning a target Team/Moniker.
  - Preserving historical stats.
  - Validating expected display after the move.
- U19 graduation/class-year eligibility was audited and fixed for live public boards.
- Root cause:
  - Live public rankings read current `PlayerRating` rows and birthdate-derived eligibility.
  - Manual `classYearOverride` changes were not included in the live ranking eligibility path.
- Live public rankings now include `classYearOverride` when computing whether a U19 player is out of range after the June 1 transition.
- This is a display/filter eligibility fix only:
  - No players were deleted.
  - No ratings were reset.
  - No snapshots were generated.
  - No rating formula math changed.
- No database writes, imports, schema changes, migrations, recomputes, snapshot generation, Formula v2 work, deletes, or merges were performed.

## Transfer and Roster Assignment Model Audit

- Transfer / roster model audit completed.
- Current model distinction:
  - `Player.currentProgramId` is the player's current profile Program / school / club identity.
  - `Team.programId` links an internal Team / Moniker record to a Program.
  - `GameStat.teamId`, `Game.homeTeamId`, and `Game.awayTeamId` are historical game/stat evidence and should remain tied to the Team / Moniker used when the game was recorded.
  - `PlayerProgramHistory` records transfer history, but it does not by itself assign a player to a Team / Moniker roster.
  - `PlayerTeamSeason` already exists as a roster-like model with `playerId`, `teamId`, `seasonId`, `startsOn`, `endsOn`, `adminOverride`, `overrideReason`, and `deletedAt`.
- Current Program detail behavior:
  - Team sections are built from active historical `GameStat.teamId` evidence under the Program's Teams.
  - Program-level / unassigned players are players whose `currentProgramId` points to the Program but who do not have active GameStats under the current Team sections.
  - Therefore a transferred player can still appear under the old Program through historical stats and can also appear in the new Program as Program-level / unassigned.
  - The old Program appearance is historical evidence, not necessarily current membership.
  - The target Program unassigned state means current Program was moved, but no current Team / Moniker roster assignment was created.
- Recommended model:
  - Use existing `PlayerTeamSeason` as the current/future roster assignment table instead of rewriting historical GameStats.
  - Treat `Player.currentProgramId` as the profile-level current Program.
  - Treat `PlayerTeamSeason` as the player's current or historical roster/Team assignment by season.
  - Treat `GameStat.teamId` as immutable historical stat identity for normal transfers.
- Recommended future workflow:
  1. Admin selects target Program.
  2. Admin selects target Team / Moniker under that Program, or creates/selects an appropriate current roster Team when supported.
  3. UI clearly states old historical games and stats will not move.
  4. Write only `Player.currentProgramId`, `PlayerProgramHistory`, and the active/current `PlayerTeamSeason` assignment as explicitly confirmed.
  5. Validate that the player appears in the new current roster while old stats remain visible only as historical evidence.
- Recommended Program detail display split:
  - Current roster players: active `PlayerTeamSeason` rows for the selected Program / Team / season.
  - Historical stat players: players with `GameStat.teamId` evidence under Program Teams.
  - Program-level / unassigned players: players with `currentProgramId` but no active roster assignment.
  - Team Profile roster should eventually prefer active `PlayerTeamSeason`, with historical stat contributors shown separately if needed.
- Guardrails:
  - Never rewrite `GameStat.teamId`, `Game.homeTeamId`, or `Game.awayTeamId` during a normal transfer.
  - Never delete old Program/Team evidence during a normal transfer.
  - Require confirmation for current Program transfer.
  - Require a separate explicit action for Team / Moniker roster assignment.
  - Transfer alone must not change ratings, rankings, stat values, snapshots, or player game history.
- No code behavior changes, database writes, schema changes, migrations, imports/publish, rating recomputes, snapshot generation, deletes, merges, or historical stat rewrites were performed for this audit.

## PlayerTeamSeason Roster Assignment Workflow Checkpoint

- Guarded current roster/team assignment workflow was added using the existing `PlayerTeamSeason` model.
- Program detail now separates:
  - Current roster assignments from active `PlayerTeamSeason` rows.
  - Historical stat evidence from `GameStat.teamId`.
  - Program-level / unassigned players with `Player.currentProgramId` but no current Team / Moniker roster assignment.
- Player current Program tools can now optionally assign a target Team / Moniker + Season during an edit or transfer.
- The roster assignment action updates only:
  - `Player.currentProgramId`.
  - `PlayerProgramHistory` when Transfer mode is selected.
  - `PlayerTeamSeason` for the selected Team + Season.
- Guardrails added:
  - Target Team must belong to the selected target Program.
  - Target Season must belong to the selected Team / Moniker context.
  - Admin confirmation is required before writing a roster assignment.
  - UI copy states that historical games and stats will not move.
- Historical stat identity remains immutable for normal transfers:
  - `GameStat.teamId` is not rewritten.
  - `Game.homeTeamId` and `Game.awayTeamId` are not rewritten.
  - Old Program / Team / Moniker evidence is preserved.
- No schema changes, migrations, imports/publish, rating recomputes, snapshot generation, deletes, merges, public ranking logic changes, or historical stat rewrites were made.

## Global Roster Assignment Selector Rule Checkpoint

- Global admin roster assignment selector rule was added for Program detail player tools.
- Roster assignment now prefers specific Team / Moniker options that match the player's target age group and gender.
- Generic / legacy Team records are treated as fallback options when more specific Teams exist.
- Legacy / generic inference includes labels such as:
  - Jrs.
  - Juniors.
  - HS.
  - High School.
  - Varsity.
  - Team names without age/gender context when specific Teams exist.
- Selector grouping now supports:
  - Recommended exact age/gender matches.
  - Fallback same-gender Teams when no exact match exists.
  - Other same-gender Teams behind a `Show other same-gender teams` override.
  - Legacy/generic Teams behind a `Show legacy/generic teams` override.
  - Opposite-gender or unclear Teams behind a stronger all-teams override.
- Generic-only Programs and Programs with a single Team remain assignable as fallbacks.
- Existing roster assignment guardrails remain unchanged:
  - Target Team must belong to the selected Program.
  - Target Season must match the selected Team / Moniker context.
  - Admin confirmation remains required.
  - Historical `GameStat` and `Game` rows are not rewritten.
- No database writes, deletes, merges, schema changes, migrations, imports/publish, rating recomputes, snapshot generation, public UI changes, or ranking/rating formula changes were made.

## Global Program Management Player Grouping Checkpoint

- Global Admin Program Management player grouping rules were added to Program detail.
- Editable player visibility now includes:
  - Players whose `Player.currentProgramId` equals the Program.
  - Players with active `PlayerTeamSeason` assignments to Teams under the Program.
  - Players with historical `GameStat.teamId` evidence under Teams in the Program when relevant.
- `PlayerTeamSeason` / current roster players now appear in editable Program player rows even if they do not yet have GameStats for that Team.
- Current roster display is separated by gender:
  - Current Roster — Boys.
  - Current Roster — Girls.
- Graduated players are separated from current roster and remain editable:
  - Graduated Players — Boys.
  - Graduated Players — Girls.
- Graduation grouping uses the same ranking age/class-year eligibility helper path used by live rankings.
- Unassigned / Program-level players now means current Program players with no active current roster assignment under that Program.
- Historical Stat Evidence remains separate and is still based on immutable `GameStat.teamId` history.
- Empty/generic historical Team records are hidden from normal Historical Stat Evidence and retained behind a collapsed `Show empty/legacy teams` audit section.
- Generic/legacy hiding follows the same selector direction:
  - Jrs.
  - Juniors.
  - HS.
  - High School.
  - Varsity.
  - Generic Team names without age/gender context when more specific Teams exist under the Program.
- Historical stats remain immutable:
  - `GameStat.teamId` was not rewritten.
  - `Game.homeTeamId` and `Game.awayTeamId` were not rewritten.
  - No Program / Team records were deleted, merged, or retired.
- No database writes, schema changes, migrations, imports/publish, rating recomputes, snapshot generation, public UI changes, or ranking/rating formula changes were made.

## Nickson Visibility and Generic Team Cleanup Plan Checkpoint

- Nickson / `PlayerTeamSeason` visibility diagnostic completed.
- Current DB state for Nickson:
  - Player: `29efab25-9417-43be-a879-9654ac889bac` / Nickson Cabañero.
  - Current Program: `85268294-bd6d-4121-b06d-106d2b7d8929` / University of Santo Tomas.
  - Active `PlayerTeamSeason`: `541ca8f9-078e-4137-adba-2c13b7595fbe`.
  - Assigned Team: `d56b5b1a-62c0-4639-993d-b6c2fb15e923` / UST Tiger Cubs.
  - Season: `77858fdc-9a0b-4b4a-8820-4ad0a105a8a9` / Season 88.
  - Nickson is present in current Program players and `PlayerTeamSeason` roster players.
  - Nickson has no historical UST GameStats yet.
  - Nickson is not graduated and should not be grouped as graduated.
- Root cause:
  - The data exists and the Program detail loader should show Nickson in current roster.
  - The assigned Team in the database is `UST Tiger Cubs`, not a separate `UST Tiger Cubs U19` Team.
  - Program Management hiding logic was tightened so generic Teams with active current roster assignments are not hidden as empty legacy Teams.
- Added `scripts/plan-retire-generic-teams.ts`.
- Added `npm.cmd run plan:retire-generic-teams`.
- Dry-run report path:
  - `scripts/reports/generic-team-retirement-plan.json`.
- Generic Team dry-run summary:
  - Total candidates: 38.
  - Safe to retire from active UI: 9.
  - Needs review because history exists: 20.
  - Blocked because current roster exists: 9.
- UST dry-run status:
  - `UST` has 0 current roster rows, 0 active GameStats, 0 active official games, and is `SAFE_TO_RETIRE_FROM_ACTIVE_UI`.
  - `UST Jrs (UST)` has 16 current roster rows and is `BLOCKED_HAS_CURRENT_ROSTER`.
  - `UST Tiger Cubs` has 1 current roster row, 191 active GameStats, 14 active official games, and is `BLOCKED_HAS_CURRENT_ROSTER`.
- Normal Program Management now excludes only generic/legacy Teams that are empty of active non-graduated players and active current roster assignments.
- Generic/legacy Teams with current roster rows or historical evidence remain protected and visible/reviewable.
- No database writes, deletes, merges, schema changes, migrations, imports/publish, rating recomputes, snapshot generation, public UI changes, GameStat/Game rewrites, or ranking/rating formula changes were made.

## Generic Roster Reassignment Dry-run Checkpoint

- Added guarded dry-run planner for active `PlayerTeamSeason` rows assigned to generic / legacy Teams.
- Script added:
  - `scripts/plan-reassign-generic-rosters.ts`.
- Package command added:
  - `npm.cmd run plan:reassign-generic-rosters`.
- Report outputs:
  - `scripts/reports/generic-roster-reassignment-plan.md`.
  - `scripts/reports/generic-roster-reassignment-plan.json`.
- The planner finds generic / legacy Teams with active current roster assignments when the same Program has more specific age/gender Team options.
- Matching rules:
  - Prefer exact same gender + age group.
  - Boys U19 should map only to U19 boys-specific Teams.
  - Boys U16 should map only to U16 boys-specific Teams.
  - Girls should map only to girls-specific Teams.
  - Target Team must have the same Season context as the current `PlayerTeamSeason` row.
  - Unclear age group, no target, or multiple targets are not auto-ready.
- Confidence labels:
  - `AUTO_READY`.
  - `NEEDS_REVIEW`.
  - `BLOCKED_NO_TARGET`.
  - `BLOCKED_MULTIPLE_TARGETS`.
- Generic Teams with active roster rows require roster-only reassignment review before they can be retired or hidden from active Program Management.
- Latest dry-run result:
  - Total active generic roster rows: 127.
  - `AUTO_READY`: 0.
  - `NEEDS_REVIEW`: 0.
  - `BLOCKED_NO_TARGET`: 127.
  - `BLOCKED_MULTIPLE_TARGETS`: 0.
- UST Jrs dry-run result:
  - 16 active roster rows were inspected.
  - All 16 are `BLOCKED_NO_TARGET` because no same-Season specific Team target was available under the strict matching rule.
  - This includes mostly U19 Boys players plus one U16 Boys player.
- Implication:
  - Generic Teams with active roster rows cannot be safely retired yet.
  - Specific target Team/Season context needs to exist before a future roster-only reassignment execute path can be prepared.
- Historical stats remain immutable:
  - `GameStat.teamId` is not rewritten.
  - `Game.homeTeamId` and `Game.awayTeamId` are not rewritten.
- No database writes, deletes, merges, schema changes, migrations, imports/publish, rating recomputes, snapshot generation, public UI changes, GameStat/Game rewrites, or ranking/rating formula changes were made.

## Generic Roster Target Availability Diagnostic

- Generic roster target availability diagnostic completed.
- `scripts/plan-reassign-generic-rosters.ts` now includes Program Team inventory and rejected target reasons in the dry-run reports.
- Refreshed reports:
  - `scripts/reports/generic-roster-reassignment-plan.md`.
  - `scripts/reports/generic-roster-reassignment-plan.json`.
- Schema finding:
  - There is no separate Team-season availability table.
  - A Team's season availability is inferred from `Game`, `GameStat`, and active `PlayerTeamSeason` evidence.
  - `PlayerTeamSeason` is unique by `playerId + seasonId`, so roster-only reassignment must remain one active Team assignment per player per Season.
- UST diagnostic:
  - Program: `85268294-bd6d-4121-b06d-106d2b7d8929` / University of Santo Tomas.
  - `UST Jrs (UST)` has 16 active `PlayerTeamSeason` rows in `UAAP Season 88 HS Boys Basketball / Season 88`.
  - `UST Jrs (UST)` has 0 active GameStats and 0 active Games.
  - `UST Tiger Cubs` has the same HS Boys Season context, 1 active roster row, 191 active GameStats, and 14 active Games, but is still considered generic because it lacks explicit age text in the Team name while more specific Teams exist.
  - `UST Tiger Cubs 16U` is specific U16 Boys, but it is linked to `UAAP Season 88 16U Boys Basketball / Season 88`, not the HS Boys Season used by `UST Jrs (UST)`.
  - `UST Tigress Cubs` is U19 Girls and is linked to the HS Girls Season.
  - `UST Girls (UST)` has no linked season evidence.
- Why `UST Jrs (UST)` has no exact target:
  - For the mostly U19 Boys roster rows, no specific U19 Boys Team exists under UST for the same HS Boys Season.
  - For JC Canapi, inferred U16 Boys, `UST Tiger Cubs 16U` exists but is linked to the separate UAAP 16U Boys Season, not the HS Boys Season currently on the `UST Jrs (UST)` roster row.
  - The planner is intentionally strict about same-season reassignment, so it blocks cross-season moves.
- Diagnosis:
  - The blocker is primarily missing exact specific Team / Season setup, not a database write issue and not a rating/ranking issue.
  - The planner is strict by design; it is not safe to auto-move active roster rows across Season contexts.
- Suggested next safe step:
  - Decide whether UST HS Boys current roster should use existing `UST Tiger Cubs` despite the generic-name flag, or create/approve a specific U19 Boys Team / Moniker setup before any future roster-only execute path.
  - For U16 players currently assigned to an HS Boys Season row, review whether their roster Season should remain HS Boys or be reassigned through an explicit admin-approved roster workflow.
- Historical stats remain immutable:
  - `GameStat.teamId` is not rewritten.
  - `Game.homeTeamId` and `Game.awayTeamId` are not rewritten.
- No database writes, deletes, merges, schema changes, migrations, imports/publish, rating recomputes, snapshot generation, public UI changes, GameStat/Game rewrites, roster reassignments, or ranking/rating formula changes were made.

## Global Legacy Team Visibility Regression Fix

- Global Admin Program Management legacy Team visibility regression was fixed.
- Root cause:
  - The previous safety pass kept generic / legacy Teams with active `PlayerTeamSeason` rows in the normal `Current Teams / Monikers` and `Current Roster` paths so players would not disappear.
  - That protected editability, but it also restored old/generic additional Teams into normal active Program Management across many Programs.
- Normal Program Management now separates Team visibility globally:
  - `Current Teams / Monikers` shows only specific age/gender Team records when specific Teams exist under the Program.
  - Generic / legacy Team records are hidden from normal current Team counts when specific Teams exist.
  - Programs with only generic Teams remain usable instead of being emptied.
- Generic Teams with active roster rows:
  - No longer appear as normal current roster groups.
  - Appear in collapsed `Legacy Roster Assignments Needing Review`.
  - Players remain editable from that review section.
- Generic Teams with historical evidence only:
  - No longer appear as normal historical/current player sections.
  - Appear in collapsed `Historical/legacy evidence`.
  - Historical evidence remains visible for audit and player access when needed.
- Empty generic Teams:
  - Are hidden from normal Program Management.
  - Remain visible only through collapsed legacy/audit sections.
- Updated admin copy stays concise:
  - `Legacy roster assignments need review`.
  - `Historical evidence is preserved and does not mean current roster membership`.
- Existing read-only diagnostic still reports:
  - Generic Team candidates: 38.
  - Safe to retire from active UI: 9.
  - Needs review because history exists: 20.
  - Blocked because current roster exists: 9.
- Guardrails preserved:
  - Players remain editable.
  - `GameStat.teamId` is not rewritten.
  - `Game.homeTeamId` and `Game.awayTeamId` are not rewritten.
  - No Program / Team records were deleted, merged, or retired.
- No database writes, deletes, merges, schema changes, migrations, imports/publish, rating recomputes, snapshot generation, public UI changes, GameStat/Game rewrites, roster reassignments, or ranking/rating formula changes were made.
- TypeScript passed with `npx.cmd tsc --noEmit`.

## Conservative Program Team Visibility Fix

- Over-aggressive Program Management Team hiding was corrected.
- Root cause:
  - The prior classifier treated any Team without explicit age/gender text in its name as generic when a specific sibling existed.
  - That incorrectly moved legitimate Teams with girls, U16, U19, league, season, game, or GameStat context out of normal Program Management.
- New default rule:
  - Default is show.
  - Only high-confidence empty generic / legacy Teams are collapsed from normal current Team view.
  - Uncertain Teams with active games, GameStats, roster rows, league context, or season context remain visible.
- Conservative visibility classes:
  - `VISIBLE_SPECIFIC`: clear name or context such as U13/U16/U19, 13U/16U/19U, Boys/Girls, Lady/Tigress, age group, gender, league, or season evidence.
  - `VISIBLE_REVIEW_CONTEXT`: uncertain name but real evidence exists, so the Team stays visible with review context.
  - `LEGACY_ROSTER_REVIEW`: generic / legacy Team name with active `PlayerTeamSeason` rows and no active game/stat evidence; players stay editable in the review section.
  - `COLLAPSED_EMPTY_LEGACY`: generic / legacy Team with no active roster rows and no meaningful active evidence when more specific Teams exist.
- Read-only diagnostic under the conservative rules:
  - `VISIBLE_SPECIFIC`: 36 Teams.
  - `VISIBLE_REVIEW_CONTEXT`: 17 Teams.
  - `LEGACY_ROSTER_REVIEW`: 8 Teams.
  - `COLLAPSED_EMPTY_LEGACY`: 9 Teams.
- UST behavior after fix:
  - `UST Girls (UST)` is visible normally.
  - `UST Tiger Cubs 16U` is visible normally.
  - `UST Tigress Cubs` is visible normally.
  - `UST Tiger Cubs` remains visible as review-context because it has U19 boys game/stat evidence.
  - `UST Jrs (UST)` is in `Legacy Roster Assignments Needing Review` because it has active roster rows but no game/stat evidence.
  - Empty `UST` is collapsed as empty legacy/audit.
- Generic-only Programs still work because no Team is collapsed when no specific sibling Team exists.
- Players remain editable:
  - Current roster players remain editable in normal sections.
  - Legacy roster assignment players remain editable in the review section.
  - Historical evidence remains available in collapsed audit sections where applicable.
- No database writes, deletes, merges, schema changes, migrations, imports/publish, rating recomputes, snapshot generation, public UI changes, GameStat/Game rewrites, roster reassignments, or ranking/rating formula changes were made.
- TypeScript passed with `npx.cmd tsc --noEmit`.

## Legacy Team Canonicalization Dry-run Plan

- Added guarded read-only canonicalization planner:
  - `scripts/plan-canonicalize-legacy-teams.ts`
  - package command: `npm.cmd run plan:canonicalize-legacy-teams`
- Reports are written to:
  - `scripts/reports/legacy-team-canonicalization-plan.md`
  - `scripts/reports/legacy-team-canonicalization-plan.json`
- Purpose:
  - Referenced legacy / generic Teams should be canonicalized when references are wrong or duplicate.
  - Hiding legacy Teams is temporary; safe reassignment to canonical Teams is preferred before any delete / retire / archive step.
  - Historical Team / Moniker evidence is preserved unless a later explicit approval says the Game / GameStat references are duplicate and safe to reassign.
- Planner guardrails:
  - Dry-run / read-only only.
  - No execute mode was added.
  - No database writes, deletes, merges, schema changes, imports/publish, rating/ranking recomputes, snapshots, GameStat rewrites, or Game rewrites.
  - Future execute paths must require exact Team IDs, reference counts, and explicit approval.
- Recommendation categories:
  - `AUTO_READY_ROSTER_ONLY`
  - `NEEDS_REVIEW_ROSTER_ONLY`
  - `AUTO_READY_GAME_AND_STATS`
  - `NEEDS_REVIEW_GAME_AND_STATS`
  - `KEEP_HISTORICAL_REFERENCE`
  - `SAFE_TO_DELETE_ZERO_REFERENCES`
  - `BLOCKED_NO_CANONICAL_TARGET`
  - `BLOCKED_AMBIGUOUS_TARGETS`
- Dry-run summary:
  - Total legacy Teams inspected: 38.
  - `AUTO_READY_ROSTER_ONLY`: 0.
  - `NEEDS_REVIEW_ROSTER_ONLY`: 5.
  - `AUTO_READY_GAME_AND_STATS`: 0.
  - `NEEDS_REVIEW_GAME_AND_STATS`: 0.
  - `KEEP_HISTORICAL_REFERENCE`: 1.
  - `SAFE_TO_DELETE_ZERO_REFERENCES`: 13.
  - `BLOCKED_NO_CANONICAL_TARGET`: 18.
  - `BLOCKED_AMBIGUOUS_TARGETS`: 1.
- UST Jrs result:
  - `UST Jrs (UST)` has 16 active `PlayerTeamSeason` roster rows.
  - It has 0 active `GameStat` rows and 0 active Game home/away refs.
  - Best candidate target is `UST Tiger Cubs`.
  - Recommendation is `NEEDS_REVIEW_ROSTER_ONLY` because inferred roster age groups are mixed (`U16`, `U19`).
- Cleanup path documented:
  - Step A: reassign safe `PlayerTeamSeason` rows only after explicit admin approval.
  - Step B: reassign `Game.homeTeamId`, `Game.awayTeamId`, and `GameStat.teamId` only when same-team historical evidence is approved.
  - Step C: after zero references remain, retire/delete/archive the legacy Team through a separate explicit action.
  - Step D: rerun Program Management and canonicalization audits.
- TypeScript passed with `npx.cmd tsc --noEmit`.

## Roster-only Legacy Team Canonicalization Review Plan

- Added focused roster-only dry-run planner:
  - `scripts/plan-roster-only-canonicalization.ts`.
  - package command: `npm.cmd run plan:roster-only-canonicalization`.
- Reports are written to:
  - `scripts/reports/roster-only-canonicalization-plan.md`.
  - `scripts/reports/roster-only-canonicalization-plan.json`.
- Purpose:
  - Review legacy / generic Teams that have active `PlayerTeamSeason` rows but no active `GameStat` or Game home/away references.
  - Split each source Team into per-player roster assignment recommendations before any future execute path.
  - Keep historical stats immutable.
- Guardrails:
  - Dry-run / read-only only.
  - No execute mode was added.
  - No `GameStat.teamId`, `Game.homeTeamId`, or `Game.awayTeamId` rewrites.
  - No database writes, deletes, merges, schema changes, migrations, imports/publish, rating recomputes, snapshot generation, public UI changes, or ranking/rating formula changes.
- Row statuses:
  - `READY_FOR_APPROVAL`: one target Team matches Program, Season, gender, and inferred age group.
  - `NEEDS_MANUAL_TARGET`: multiple same-season target Teams match and admin must choose.
  - `BLOCKED_NO_VALID_TARGET`: no same-Program target matches Season, gender, and inferred age group.
  - `BLOCKED_CROSS_SEASON`: only same-age/gender target is in a different Season context.
- Dry-run summary:
  - Legacy Teams reviewed: 6.
  - Roster rows reviewed: 96.
  - `READY_FOR_APPROVAL`: 73.
  - `NEEDS_MANUAL_TARGET`: 0.
  - `BLOCKED_NO_VALID_TARGET`: 15.
  - `BLOCKED_CROSS_SEASON`: 8.
- UST Jrs result:
  - `UST Jrs (UST)` has 16 active `PlayerTeamSeason` rows.
  - It has 0 active `GameStat` rows and 0 active Game home/away refs.
  - 15 U19 Boys rows are `READY_FOR_APPROVAL` to `UST Tiger Cubs` in the same Season context.
  - JC Canapi is `BLOCKED_CROSS_SEASON` because the same-age/gender target `UST Tiger Cubs 16U` is in a different Season context.
- No writes were performed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

## Global Roster-only Canonicalization Execute Checkpoint

- Added guarded global roster-only execute path:
  - `scripts/execute-roster-only-canonicalization.ts`.
  - dry-run command: `npm.cmd run execute:roster-only-canonicalization:dry-run`.
  - execute command: `npm.cmd run execute:roster-only-canonicalization:execute`.
- Scope:
  - Global cleanup, not UST-only.
  - Consumed `scripts/reports/roster-only-canonicalization-plan.json`.
  - Processed only rows marked `READY_FOR_APPROVAL`.
  - Left all blocked / review rows untouched.
- Guardrails:
  - Required exactly 73 `READY_FOR_APPROVAL` rows before execution.
  - Refused to run if source `PlayerTeamSeason` rows, source Teams, target Teams, Program IDs, player IDs, or Season IDs did not match the report.
  - Verified target Teams belong to the same Program as source Teams.
  - Updated only `PlayerTeamSeason.teamId`.
  - Did not touch `GameStat.teamId`, `Game.homeTeamId`, `Game.awayTeamId`, `Player`, `Program`, `Team`, `PlayerRating`, `GamePerformanceScore`, `RankingSnapshot`, or `RankingSnapshotRow`.
- Dry-run validation:
  - Ready rows: 73.
  - Blocked rows untouched by plan: 23.
  - Protected counts unchanged.
- Execution result:
  - `PlayerTeamSeason.teamId` rows updated: 73.
  - Programs included:
    - Adamson University: 14 rows from `ADU Jrs (ADU)` to `Adamson Baby Falcons`.
    - Ateneo de Manila University: 15 rows from `ATENEO JRS (ATENEO)` to `Ateneo Blue Eaglets`.
    - Far Eastern University Diliman: 14 rows from `FEU Jrs (FEU)` to `FEU - Diliman Baby Tamaraws`.
    - National University Nazareth School: 15 rows from `NU Jrs (NU)` to `NUNS Bullpups`.
    - University of Santo Tomas: 15 rows from `UST Jrs (UST)` to `UST Tiger Cubs`.
- Blocked rows remained untouched:
  - 23 rows remain blocked after execution.
  - Post-execute roster-only planner summary:
    - Legacy Teams reviewed: 6.
    - Roster rows reviewed: 23.
    - `READY_FOR_APPROVAL`: 0.
    - `NEEDS_MANUAL_TARGET`: 0.
    - `BLOCKED_NO_VALID_TARGET`: 15.
    - `BLOCKED_CROSS_SEASON`: 8.
  - UST remaining blocked row:
    - JC Canapi remains on `UST Jrs (UST)` as `BLOCKED_CROSS_SEASON`; same-age/gender target is `UST Tiger Cubs 16U`, but it is in a different Season context.
- Post-execute canonicalization planner summary:
  - Total legacy Teams inspected: 38.
  - `AUTO_READY_ROSTER_ONLY`: 5.
  - `NEEDS_REVIEW_ROSTER_ONLY`: 0.
  - `AUTO_READY_GAME_AND_STATS`: 0.
  - `NEEDS_REVIEW_GAME_AND_STATS`: 0.
  - `KEEP_HISTORICAL_REFERENCE`: 1.
  - `SAFE_TO_DELETE_ZERO_REFERENCES`: 13.
  - `BLOCKED_NO_CANONICAL_TARGET`: 18.
  - `BLOCKED_AMBIGUOUS_TARGETS`: 1.
- Post-execute generic Team retirement planner summary:
  - Candidate count: 38.
  - Safe to retire from active UI: 9.
  - Needs review because history exists: 16.
  - Blocked because current roster exists: 13.
- Protected counts remained unchanged:
  - Games: 300.
  - GameStats: 6960.
  - GamePerformanceScores: 6340.
  - PlayerRatings: 611.
  - RankingSnapshots: 3.
  - RankingSnapshotRows: 511.
  - Players: 648.
  - Programs: 29.
  - Teams: 70.
- No deletes, merges, schema changes, migrations, imports/publish, rating recomputes, snapshot generation, public UI changes, Game/GameStat rewrites, or ranking/rating formula changes were performed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

## Zero-reference Legacy Team Cleanup Checkpoint

- Added guarded zero-reference legacy Team cleanup script:
  - `scripts/cleanup-zero-reference-legacy-teams.ts`.
  - dry-run command: `npm.cmd run cleanup:zero-reference-legacy-teams:dry-run`.
  - execute command: `npm.cmd run cleanup:zero-reference-legacy-teams:execute`.
- Cleanup behavior:
  - Uses latest generic Team retirement and legacy canonicalization reports as candidate sources.
  - Independently validates every Team has zero references before cleanup.
  - Reference checks include:
    - `PlayerTeamSeason.teamId`.
    - `GameStat.teamId`.
    - `Game.homeTeamId`.
    - `Game.awayTeamId`.
    - `TeamRating.teamId`.
    - submission/import/draft Team refs: none found as direct Team foreign keys in the current Prisma schema.
  - Uses soft-delete/archive via `Team.deletedAt` because the Team model supports `deletedAt`.
  - Does not hard-delete Teams.
- Dry-run result:
  - 15 zero-reference legacy / duplicate Teams proposed for archive.
  - Every proposed Team had total reference count 0.
- Execution result:
  - Archived 15 zero-reference Teams:
    - `ATENEO` / Ateneo de Manila University.
    - `De La Salle Santiago Zobel` / De La Salle Santiago Zobel.
    - `DLSU` / De La Salle Santiago Zobel.
    - `DLSZ` / De La Salle Santiago Zobel.
    - `LA SALLE` / De La Salle Santiago Zobel.
    - `JMTG Medical Trading Infinite U16 Boys` / JMTG Medical Trading Infinite.
    - `Lev Construction Full Potential U16 Boys` / Lev Construction Full Potential.
    - `Migrafix Doc Boleros U16 Boys` / Migrafix Doc Boleros.
    - `Migueluz Trading Moderno U16 Boys` / Migueluz Trading Moderno.
    - `NU` / National University Nazareth School.
    - `Prime Ascencion Medical Supplies San Anton U16 Boys` / Prime Ascencion Medical Supplies San Anton.
    - `San Pedro Spartans U16 Boys` / San Pedro Spartans.
    - `SPARTANS U16 Boys` / San Pedro Spartans.
    - `SMILE 360 BULLIES U16 Boys` / Smile 360 Bullies.
    - `UST` / University of Santo Tomas.
- Protected counts:
  - Games unchanged: 300.
  - GameStats unchanged: 6960.
  - GamePerformanceScores unchanged: 6340.
  - PlayerRatings unchanged: 611.
  - RankingSnapshots unchanged: 3.
  - RankingSnapshotRows unchanged: 511.
  - Players unchanged: 648.
  - Programs unchanged: 29.
  - Total Teams unchanged: 70 because soft-delete/archive was used.
  - Active Teams decreased from 70 to 55.
- Post-cleanup reports:
  - Generic Team retirement planner:
    - Candidate count: 24.
    - Safe to retire from active UI: 2.
    - Needs review because history exists: 9.
    - Blocked because current roster exists: 13.
  - Legacy canonicalization planner:
    - Total legacy Teams inspected: 27.
    - `AUTO_READY_ROSTER_ONLY`: 5.
    - `NEEDS_REVIEW_ROSTER_ONLY`: 0.
    - `AUTO_READY_GAME_AND_STATS`: 0.
    - `NEEDS_REVIEW_GAME_AND_STATS`: 0.
    - `KEEP_HISTORICAL_REFERENCE`: 1.
    - `SAFE_TO_DELETE_ZERO_REFERENCES`: 2.
    - `BLOCKED_NO_CANONICAL_TARGET`: 18.
    - `BLOCKED_AMBIGUOUS_TARGETS`: 1.
  - Roster-only canonicalization planner:
    - Legacy Teams reviewed: 6.
    - Roster rows reviewed: 23.
    - `READY_FOR_APPROVAL`: 0.
    - `NEEDS_MANUAL_TARGET`: 0.
    - `BLOCKED_NO_VALID_TARGET`: 15.
    - `BLOCKED_CROSS_SEASON`: 8.
- Referenced legacy Teams remain for separate review / canonicalization.
- No referenced Teams were archived.
- No Game/GameStat rows, Player rows, Program rows, ratings, snapshots, imports, publishes, schemas, migrations, deletes, merges, or ranking/rating formulas were changed.
- TypeScript passed with `npx.cmd tsc --noEmit`.

## Final MVP Stabilization QA Checkpoint

- Final MVP stabilization QA was run after roster cleanup, zero-reference Team archival, public UI polish, live ranking changes, and admin workflow updates.
- Scope checked:
  - Public rankings: `/rankings`, live PlayerRating-backed ranking helper, search/filter rank preservation, age-group filters, and `101+` rank-band display.
  - Player profiles: `/players/[slug]`, recent form, Player Intelligence, shooting bars, best game, League History, ranking trend, and filterable Full Game Log.
  - Team/game pages: `/teams`, `/teams/[id]`, `/games/[id]`, Team Rankings grouping, team profiles, long team-name wrapping, and public game-number display.
  - Admin: `/admin/programs`, `/admin/programs/[id]`, `/admin/submissions/[id]`, roster assignment selector, legacy roster review sections, archived Team filtering, and step-based submission review flow.
  - Content pages: `/privacy`, `/terms`, `/about`, `/how-we-rank`, `/methodology`, footer links, and connect links.
- Findings:
  - Public Player Rankings preserve board rank during search/filtering through `rankByPlayerId`.
  - Public rank bands use `#101-150`, `#151-200`, etc. through `formatPublicRank`.
  - Ranking data still comes from the live `PlayerRating` source; Formula v2 remains preview/design only.
  - Player profiles expose public analytics without Premium gates.
  - Public player/game/team UI uses game numbers or links by route id, but no visible `Game UID` label was found in inspected public pages.
  - Team Rankings continue to normalize PYBC full-competition grouping and filter out archived Teams through `deletedAt: null`.
  - Program Management active Team loaders use `deletedAt: null`, while legacy roster review remains accessible for referenced generic Teams.
  - Submission detail keeps the guided review flow and separates high-impact import/publish processing from review sections.
  - Footer/content links are present for Privacy Policy, Terms of Use, About, and How We Rank.
- Issues found:
  - No P0 blockers found in the inspected MVP demo scope.
  - Residual blocked legacy roster rows remain by design for later manual review; they are not a demo blocker because they are separated from normal active Team display.
  - Privacy/Terms still contain placeholder legal/contact values and should be reviewed before a full public launch.
- Recommended status:
  - Demo-ready for MVP walkthrough after a browser smoke test on desktop/mobile.
  - Do not run imports, repairs, rating recomputes, or Formula v2 writes during demo prep.
- No database writes, deletes, imports/publish, recomputes, snapshots, schema changes, migrations, rating/ranking formula changes, or new features were performed during this QA pass.

## Post-MVP Cleanup Plan Checkpoint

- Post-MVP cleanup planning audit completed for debugging, dead code removal, generated report hygiene, and database cleanup candidates.
- This was a planning pass only:
  - No files were deleted.
  - No database records were deleted or modified.
  - No cleanup / repair execute scripts were run.
  - No schema changes, migrations, imports/publish, rating recomputes, snapshot generation, merges, broad UI changes, or formula changes were performed.
- Commands / inspections used:
  - `npx.cmd tsc --noEmit`.
  - `package.json` scripts inventory.
  - `prisma/schema.prisma` relationship inspection.
  - `scripts` and `scripts/reports` inventory.
  - Source searches for debug markers, Premium remnants, invalid Tailwind opacity utilities, mojibake / encoding artifacts, route remnants, and internal `Game UID` wording.
- TypeScript result:
  - Passed with `npx.cmd tsc --noEmit`.

Cleanup categories:

- `SAFE_REMOVE_CODE` candidates:
  - Old plain JavaScript planning / diagnostic scripts with TypeScript replacements:
    - `scripts/create-approved-merge-plan-round-2.js`.
    - `scripts/diagnose-duplicate-players-round-2.js`.
  - Old no-op / placeholder import scripts after confirming no package script or docs still require them:
    - `scripts/import-uaap-feu-ue.ts`.
    - `scripts/import-uaap-season88-batch.ts`.
- `NEEDS_REVIEW_CODE` candidates:
  - Legacy portal surfaces still using `src/lib/mock-data.ts`:
    - `src/app/portal/PortalDashboardClient.tsx`.
    - `src/app/portal/players/PlayerManagementClient.tsx`.
    - `src/components/layout/SearchOverlay.tsx`.
    - `src/app/claim/page.tsx`.
    - `src/app/partner/page.tsx`.
  - Older public routes still present outside the main MVP demo path:
    - `/licensed`.
    - `/partner`.
    - `/careers`.
    - `/faqs`.
    - `/administrator` / `/owner` redirects.
  - `src/components/ui/PremiumGate.tsx` remains intentionally available for future business-model work, but should stay unused publicly while Premium Access is deferred.
  - Duplicate / older public primitives should be reviewed before removal because some are still imported by legacy pages:
    - `src/components/player-card.tsx`.
    - `src/components/sections/PlayerHero.tsx`.
    - `src/components/sections/LeagueGrid.tsx`.
    - `src/components/public/LeagueCard.tsx`.
    - mock-data-backed UI helpers.
- `SAFE_ARCHIVE_FILE` candidates:
  - Large generated reports under `scripts/reports` that are no longer active source-of-truth after later repairs:
    - older duplicate player cleanup reports.
    - older PYBC participant / suffix duplicate reports.
    - old extra GameStat / GamePerformanceScore reports.
    - old formula comparison reports if Formula v2 reports are retained elsewhere.
  - One-off audit and repair scripts should be moved to a documented archive folder only after confirming their latest output is captured in `PROJECT_STATUS.md`.
- `SAFE_DELETE_ZERO_REFERENCE_DB` candidates:
  - None should be executed immediately.
  - Previously identified zero-reference Teams were soft-archived, not hard-deleted.
  - Any future hard-delete must rerun a fresh zero-reference dry-run and verify all Team foreign keys:
    - `PlayerTeamSeason.teamId`.
    - `GameStat.teamId`.
    - `Game.homeTeamId`.
    - `Game.awayTeamId`.
    - `TeamRating.teamId`.
    - any new Team FK added later.
- `NEEDS_CANONICALIZATION_FIRST` candidates:
  - Referenced legacy Teams still reported by cleanup plans:
    - legacy Teams with historical Game / GameStat evidence.
    - legacy Teams with blocked `PlayerTeamSeason` rows.
    - ambiguous legacy Teams without a safe canonical target.
  - Remaining blocked roster-only rows:
    - 23 rows after the global roster-only canonicalization execute.
    - 15 `BLOCKED_NO_VALID_TARGET`.
    - 8 `BLOCKED_CROSS_SEASON`.
- `KEEP_FOR_AUDIT` candidates:
  - Formula v2 preview / write-plan reports until Formula v2 storage and rollout are implemented or formally rejected.
  - Latest roster-only, legacy canonicalization, generic Team retirement, and zero-reference cleanup reports until the next cleanup phase completes.
  - `PremiumGate` component if the future Premium model is still expected.
- `BLOCKED` candidates:
  - Formula v2 execute path remains blocked by current schema constraints:
    - `GamePerformanceScore.gameStatId` uniqueness prevents v1/v2 coexistence.
    - `PlayerRating` uniqueness on `playerId + ageGroup` prevents safe side-by-side v2 ratings.
  - Any database cleanup involving referenced historical `Game`, `GameStat`, rating, or snapshot records is blocked without a new dry-run report and explicit approval.

Debug / quality issues to fix first:

- Mojibake / encoding artifacts are visible in legacy portal UI:
  - `src/app/portal/PortalDashboardClient.tsx`.
  - `src/app/portal/players/PlayerManagementClient.tsx`.
- No `text-white/72` or other searched `/72` Tailwind opacity utility remained in the inspected source.
- No visible public `Game UID` wording was found in inspected source; existing public pages use game numbers or route IDs.
- Console logging is common in scripts and expected for CLI diagnostics; no production client `console.log` blocker was identified in the searched public source.

Recommended cleanup sequence:

1. Phase 1: Debug-only fixes.
   - Fix mojibake in legacy portal copy.
   - Recheck stale public links and placeholder copy.
   - Run `npx.cmd tsc --noEmit`.
2. Phase 2: Dead code / file cleanup.
   - Remove or archive confirmed unused `.js` scripts.
   - Review old mock-data-backed public / portal surfaces before deleting components.
   - Archive stale generated reports only after confirming latest status checkpoints preserve the audit trail.
3. Phase 3: Database dry-run cleanup.
   - Rerun legacy Team canonicalization, roster-only canonicalization, generic Team retirement, and zero-reference Team cleanup planners.
   - Add duplicate Program / duplicate Player / orphaned record diagnostics if needed.
4. Phase 4: Approved executes only.
   - Execute only exact dry-run scopes approved by admin.
   - Prefer soft-delete / archive for data cleanup when supported.
   - Never rewrite historical `GameStat.teamId` or `Game.homeTeamId` / `Game.awayTeamId` without a separate explicit canonicalization approval.
5. Phase 5: Final build and QA.
   - Run TypeScript, route smoke tests, public ranking/profile checks, Program Management checks, and submission review checks.

Risks / blockers:

- Removing mock data too early can break legacy portal/search/claim routes that still import `mock-data.ts`.
- Removing old reports can erase useful audit context unless the latest outcome is documented first.
- Hard-deleting soft-archived Teams is unnecessary until a fresh zero-reference audit confirms no new references.
- Formula v2 production rollout requires schema/versioned-storage work before any write/recompute plan is safe.

## Mojibake Cleanup Checkpoint

- Mojibake / encoding artifact cleanup completed for the scoped legacy portal UI files:
  - `src/app/portal/PortalDashboardClient.tsx`.
  - `src/app/portal/players/PlayerManagementClient.tsx`.
- Cleaned visible portal copy only:
  - Corrupted compliance-rate dash now displays as `-`.
  - Corrupted loading text now displays as `Reading statsheet... 68%`.
  - Corrupted missing height / rating fallback now displays as `-`.
  - Corrupted city / region separator now displays as ` - `.
  - Corrupted verified-games fallback now displays as `-`.
- Source-wide mojibake search was run after the fix.
- Remaining match found outside this task's allowed file scope:
  - `src/app/api/licensed/access/route.ts` contains a corrupted en dash in a licensed API matchup string and should be handled in a separate scoped cleanup if needed.
- No behavior, data, auth, portal logic, PremiumGate, rating/ranking formula, database, schema, import, publish, recompute, snapshot, or file deletion changes were made.
- TypeScript passed with `npx.cmd tsc --noEmit`.

## Dead Code Review Checkpoint

- Dead / obsolete code review completed after MVP stabilization and mojibake cleanup.
- Scope was read-only code inspection plus this status update; no files, code, scripts, reports, or database records were deleted.
- Commands run:
  - `rg` searches over `src/app`, `src/components`, `src/lib`, `scripts`, and `scripts/reports`.
  - `Get-Content package.json`.
  - `rg --files` route / script / report inventory checks.
  - `npx.cmd tsc --noEmit`.
- TypeScript passed with `npx.cmd tsc --noEmit`.

Inventory summary:

- `SAFE_REMOVE_CODE` candidates:
  - `src/components/ranking-table.tsx`
    - Old ranking table component; current public rankings import `src/components/public/RankingTable.tsx`.
    - No active import was found in the inspected source.
    - Risk: low, but remove only after one final import search.
  - `src/components/organizer-registry.tsx`
    - Exported component with no active import found in inspected source.
    - Risk: low / medium because organizer surfaces still exist.
  - `scripts/create-approved-merge-plan-round-2.js`.
  - `scripts/diagnose-duplicate-players-round-2.js`.
  - `scripts/import-uaap-feu-ue.ts`.
  - `scripts/import-uaap-season88-batch.ts`.
    - Previously identified as no-op / one-off script candidates; not wired into current `package.json` scripts.
    - Risk: low if archived with audit context preserved.

- `NEEDS_REVIEW_CODE` candidates:
  - Premium / licensed remnants:
    - `src/components/ui/PremiumGate.tsx`.
    - `src/app/licensed/page.tsx`.
    - `src/app/api/licensed/access/route.ts`.
    - `PremiumGate` is currently kept for future Premium use, but public MVP messaging should continue avoiding Premium promotion.
  - Mock-data-backed or non-MVP-ready surfaces:
    - `src/components/layout/SearchOverlay.tsx`.
    - `src/app/claim/page.tsx`.
    - `src/app/partner/page.tsx`.
    - `src/app/portal/PortalDashboardClient.tsx`.
    - `src/app/organizer/OrganizerDashboardClient.tsx`.
    - `src/app/players/search/page.tsx`.
    - `src/components/player-card.tsx`.
    - `src/lib/mock-data.ts`.
    - `src/lib/demo-data.ts`.
  - Legacy / secondary route surfaces to product-review before deletion:
    - `/administrator`.
    - `/owner`.
    - `/apply`.
    - `/organizer/apply`.
    - `/careers`.
    - `/faqs`.
    - `/licensed`.
  - Mock-type-dependent profile components:
    - `src/components/sections/PlayerHero.tsx`.
    - `src/components/sections/RecentGames.tsx`.
    - `src/components/sections/CompetitionHistory.tsx`.
    - `src/components/ui/PlayerAvatar.tsx`.
    - `src/components/ui/TierBadge.tsx`.
    - These should be reviewed before removing because the current player profile still adapts live data into some legacy component shapes.
  - UI primitives exported by `src/components/ui/index.ts` with unclear active use:
    - `CourtArc`.
    - `GrainOverlay`.
    - `Skeleton` / `LeaderboardSkeleton`.
    - `TrendArrow`.
    - Treat as review-first because barrel exports can hide usage.

- `KEEP_FOR_AUDIT` candidates:
  - Executed or approved-repair scripts for PYBC identity cleanup, suffix duplicate Team repair, Program-link repair, final PYBC repair, roster-only canonicalization, and zero-reference Team cleanup.
  - Formula v2 preview / write-plan scripts and reports.
  - Current cleanup planners:
    - `scripts/plan-retire-generic-teams.ts`.
    - `scripts/plan-canonicalize-legacy-teams.ts`.
    - `scripts/plan-roster-only-canonicalization.ts`.
    - `scripts/plan-reassign-generic-rosters.ts`.
    - `scripts/cleanup-zero-reference-legacy-teams.ts`.
  - Latest generated audit reports that document executed or pending safe-cleanup scopes:
    - `formula-v2-preview.*`.
    - `formula-v2-write-plan.*`.
    - `legacy-team-canonicalization-plan.*`.
    - `roster-only-canonicalization-plan.*`.
    - `generic-team-retirement-plan.json`.
    - `zero-reference-legacy-team-cleanup-plan.*`.

- `SAFE_ARCHIVE_FILE` candidates:
  - Older generated JSON reports whose outcome is already summarized in `PROJECT_STATUS.md`.
  - Large stale comparison / diagnostic reports that can be regenerated and are no longer the latest source of truth.
  - Archive only after confirming the newest checkpoint preserves:
    - scope.
    - counts.
    - execute result if any.
    - protected-count validation.

- `BLOCKED` candidates:
  - Formula v2 execute / production storage path:
    - current schema prevents side-by-side v1/v2 `GamePerformanceScore` and `PlayerRating` storage.
  - Current import / publish / ranking / admin workflow code.
  - Dangerous cleanup scripts that can alter data:
    - player data clearing.
    - nonvalidated game cleanup.
    - GameStat / GamePerformanceScore cleanup.
    - snapshot cleanup.
    - repair execute scripts.
  - These must remain guarded or untouched until a separate dry-run and approval phase.

Package script classification:

- Current operational scripts:
  - `dev`.
  - `build`.
  - `start`.
  - `lint`.
  - `db:generate`.
  - `db:migrate`.
  - `db:seed`.
  - `db:studio`.
  - `ratings:update`.
- Audit / report scripts:
  - `audit:*`.
  - `plan:*`.
  - `ratings:v2:preview`.
  - `ratings:v2:dry-run`.
  - `retire:*:dry-run`.
  - `cleanup:*:dry-run`.
  - `execute:*:dry-run`.
- Guarded write / execute scripts that should remain clearly named and approval-only:
  - `backfill:*:execute`.
  - `repair:*:execute`.
  - `execute:roster-only-canonicalization:execute`.
  - `cleanup:zero-reference-legacy-teams:execute`.
- Obsolete / not-current package surfaces:
  - The old no-op / one-off import and duplicate diagnostic scripts listed under `SAFE_REMOVE_CODE` are not package-script entry points.

Route-surface findings:

- Public MVP routes are stable enough to keep.
- Mock-backed / product-review routes still exist and should not be deleted blindly:
  - search overlay.
  - claim flow.
  - partner flow.
  - portal / organizer dashboards.
  - licensed / Premium page.
- Deprecated Premium / licensed surfaces should be reviewed against the future Premium model before removal.
- Portal routes are not fully MVP-ready and should be treated as review-first, not safe-remove.

Recommended removal order:

1. Archive or remove high-confidence no-op scripts and unused duplicate components after one final import search.
2. Review mock-backed public / portal / claim / partner / licensed routes and decide whether to:
   - wire to live data.
   - hide from navigation.
   - archive for later.
   - remove.
3. Archive stale generated reports only after latest status checkpoints preserve the audit trail.
4. Keep executed repair scripts and latest reports until a formal audit-history archive policy exists.
5. Run a separate database cleanup phase only from fresh dry-run reports and explicit approval.

No deletion / no-change confirmation:

- No files were deleted.
- No code was removed.
- No cleanup scripts were executed.
- No database writes, imports, publishes, recomputes, snapshots, schema changes, migrations, deletes, merges, or formula changes were performed.

## Safe Dead Code Removal Checkpoint

- Highest-confidence `SAFE_REMOVE_CODE` cleanup completed.
- Reference checks were run before deletion against `src`, `scripts`, and `package.json`.
- Documentation mentions in `PROJECT_STATUS.md` were not treated as active code references.
- Deleted files:
  - `src/components/ranking-table.tsx`.
  - `src/components/organizer-registry.tsx`.
  - `scripts/create-approved-merge-plan-round-2.js`.
  - `scripts/diagnose-duplicate-players-round-2.js`.
  - `scripts/import-uaap-feu-ue.ts`.
  - `scripts/import-uaap-season88-batch.ts`.
- Skipped files:
  - None.
- Post-delete reference check found no remaining active references in `src`, `scripts`, or `package.json` for:
  - `ranking-table`.
  - `organizer-registry`.
  - `OrganizerRegistry`.
  - `create-approved-merge-plan-round-2`.
  - `diagnose-duplicate-players-round-2`.
  - `import-uaap-feu-ue`.
  - `import-uaap-season88-batch`.
- TypeScript passed with `npx.cmd tsc --noEmit`.
- No Premium/licensed code, portal/organizer/search/claim/partner routes, cleanup planners/reports, executed repair scripts, Formula v2 scripts/reports, database records, schema, imports/publish, ratings, rankings, snapshots, or broad UI behavior were changed.

## Needs Review Code Product Decision Audit

- `NEEDS_REVIEW_CODE` product-decision audit completed.
- This was a read-only inspection plus this status update:
  - No files were deleted.
  - No routes were changed.
  - No auth, portal, organizer, database, schema, import/publish, rating, ranking, snapshot, or UI behavior was changed.

Surfaces reviewed:

| Surface | Route / file | Publicly linked? | Mock-backed? | MVP-needed? | Recommendation | Removal risk | Suggested next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Premium gate component | `src/components/ui/PremiumGate.tsx` | Not directly; exported through UI barrel | No | No for public MVP, yes for future model | `DEFER_BUT_KEEP` | Medium | Keep dormant until Premium model is defined. Do not remove yet. |
| Licensed data page | `/licensed`, `src/app/licensed/page.tsx` | No nav/footer link found | No, live API-backed after login | No | `HIDE_FROM_NAV_ONLY` / `DEFER_BUT_KEEP` | Medium | Keep route unlinked; later decide whether to rebuild as Premium/B2B product or remove. |
| Licensed API | `/api/licensed/access`, `src/app/api/licensed/access/route.ts` | API only | No, queries DB | No | `BLOCKED_BY_PRODUCT_DECISION` | High | Keep until Premium/licensed business decision. Do not expose publicly in nav. |
| Global search overlay | `src/components/layout/SearchOverlay.tsx` | Yes, navbar search button | Yes, imports `mock-data` | Yes, search is public-facing | `REWRITE_LATER` | High | Replace mock-data search with live player/league search or route to `/players/search`; do not remove search UI blindly. |
| Player search page | `/players/search`, `src/app/players/search/page.tsx` | Not in main nav; legacy search component exists | Partially: live player summaries, old card helper imports demo threshold | Useful but secondary | `REWRITE_LATER` | Medium | Keep route; modernize card styling/data after global search is fixed. |
| Claim profile | `/claim`, `src/app/claim/page.tsx` | Yes, linked from player profiles | Yes, profile picker imports `mock-data`; submit API writes claim request | Yes conceptually, but current picker is stale | `REWRITE_LATER` | High | Keep CTA, but replace mock player lookup with live player lookup before relying on it in demos. |
| Partner page | `/partner`, `src/app/partner/page.tsx` | Yes, linked from portal login and redirect routes | Yes, imports regions from `mock-data`; form is client-only mock submission | Future business surface, not core demo | `DEFER_BUT_KEEP` | Medium | Hide from prominent demo path unless partnership flow is discussed; later wire to `organizerApplication` API or static contact CTA. |
| Portal login | `/portal/login`, `src/app/portal/login/page.tsx` | Yes, navbar `Submit Stats` | No, live auth | Yes | `KEEP_ACTIVE` | High | Keep active; this is the correct organizer/admin sign-in entry. |
| Portal redirect | `/portal`, `src/app/portal/page.tsx` | Indirect | No, live auth redirect | Yes | `KEEP_ACTIVE` | High | Keep as routing glue. |
| Legacy portal dashboard client | `src/app/portal/PortalDashboardClient.tsx` | No active import found | Yes | No; superseded by `/organizer` and `/admin` flows | `SAFE_REMOVE_LATER` | Low / medium | Candidate for later deletion after one final import/build check; do not remove in this review task. |
| Organizer dashboard server route | `/organizer`, `src/app/organizer/page.tsx` | Yes after organizer login | No, live DB | Yes | `KEEP_ACTIVE` | High | Keep active; this is the current organizer dashboard. |
| Legacy organizer dashboard client | `src/app/organizer/OrganizerDashboardClient.tsx` | No active import found | Yes | No; superseded by server route | `SAFE_REMOVE_LATER` | Low / medium | Candidate for later deletion after final import/build check. |
| Organizer submissions | `/organizer/submissions` | Yes inside organizer portal | No, live auth/actions | Yes | `KEEP_ACTIVE` | High | Keep active; part of MVP submission workflow. |
| Organizer live stats | `/organizer/live-stats` | Yes inside organizer portal | No, live action-backed | Yes | `KEEP_ACTIVE` | High | Keep active; part of MVP/admin tools workflow. |
| Administrator legacy page | `/administrator`, `src/app/administrator/page.tsx` | Not in main nav | No mock-data, but legacy session/auth path | No; superseded by `/admin` | `DEFER_BUT_KEEP` / `SAFE_REMOVE_LATER` | Medium | Hide/unlink; remove later only after confirming old requests workflow is fully replaced. |
| Owner redirect | `/owner`, `src/app/owner/page.tsx` | Not in main nav | No | No | `SAFE_REMOVE_LATER` | Low | Remove later if no external bookmarks need it; currently redirects to `/administrator`. |
| Apply redirect | `/apply`, `src/app/apply/page.tsx` | Not in main nav | No | No | `SAFE_REMOVE_LATER` | Low | Remove later if no external bookmarks need it; currently redirects to `/partner`. |
| Organizer apply redirect | `/organizer/apply`, `src/app/organizer/apply/page.tsx` | Not in main nav | No | No | `SAFE_REMOVE_LATER` | Low | Remove later if `/partner` remains the only application surface. |
| Careers page | `/careers`, `src/app/careers/page.tsx` | No nav/footer link found | No | No for MVP demo | `DEFER_BUT_KEEP` | Low / medium | Keep unlinked or polish later; current copy still has encoding artifacts and should not be promoted. |
| FAQs page | `/faqs`, `src/app/faqs/page.tsx` | Yes, About dropdown desktop/mobile | No | Useful, but secondary | `KEEP_ACTIVE` with polish | Low | Keep linked if copy is acceptable; otherwise fold into How We Rank / About later. |
| Header player search button | `src/components/header-player-search.tsx` | No active import found | No | No | `SAFE_REMOVE_LATER` | Low | Candidate for later deletion after final import check. |

Highest-priority decisions:

1. Rewrite navbar `SearchOverlay` to use live data or route users to the live `/players/search` flow because it is publicly linked and currently mock-backed.
2. Rewrite `/claim` player lookup to use live player records because Claim Profile CTAs are public on player profiles.
3. Keep `/portal/login`, `/portal`, `/organizer`, `/organizer/submissions`, and `/organizer/live-stats` active because they are part of the current MVP submission workflow.
4. Keep `PremiumGate` dormant and keep `/licensed` unlinked until the future Premium/licensed model is decided.
5. Treat mock-backed legacy dashboard clients and redirect-only routes as later cleanup candidates, not immediate deletion targets.
6. Do not promote `/careers` until copy/encoding polish is done.

No-change confirmation:

- No code was deleted or modified.
- No route visibility was changed.
- No auth logic was changed.
- No database writes, schema changes, migrations, imports/publish, rating recomputes, snapshots, ranking/rating formula changes, or broad UI changes were performed.

## Public Live Search Checkpoint

- Public navbar search overlay now uses live data instead of mock/stale data.
- Old search source:
  - `src/components/layout/SearchOverlay.tsx` imported players/leagues from `src/lib/mock-data.ts`.
  - Results were limited to mock Players and mock Leagues.
- New live search source:
  - Added `src/lib/public-search.ts`.
  - Added `src/app/api/search/route.ts`.
  - `SearchOverlay` now fetches `/api/search?q=...` with a short debounce and `cache: "no-store"`.
- Supported result types:
  - `Player`.
  - `Team`.
  - `League`.
- Player search:
  - Reads active `Player` records.
  - Can match name, city, region, position, and current Program fields.
  - Links to public player profiles by slug.
  - Uses current public board rows and `formatPublicRank` for rank display.
  - Shows exact `#1-100` ranks and `#101-150` style rank bands after 100.
  - Omits rank when unavailable and keeps unranked players searchable.
- Team search:
  - Reads active `Team` records with active official game/stat evidence.
  - Excludes soft-deleted / archived Teams via `deletedAt: null`.
  - Avoids exposing archived/legacy duplicate Teams in the public search path.
  - Links to public Team Profile routes.
- League search:
  - Reads active `League` records with active official games.
  - Normalizes competition display names where available.
  - Links to public League Detail routes using real League IDs.
- UI behavior:
  - Search overlay remains public and mobile usable.
  - Empty, loading, and no-result states are explicit.
  - Results use compact sports-media cards with type labels.
  - No internal IDs or Game UID values are shown.
- Verification:
  - Source check found no remaining `mock-data` usage in the navbar search path.
  - TypeScript passed with `npx.cmd tsc --noEmit`.
- No Claim Profile rewrite, Premium/licensed change, admin/import logic change, database write, schema change, import/publish, rating recompute, snapshot generation, or formula change was performed.

## Claim Profile Live Lookup Checkpoint

- Public Claim Profile lookup now uses live Player records instead of mock/stale data.
- Old claim data source:
  - `/claim` imported `players` and `formatPlayerName` from `src/lib/mock-data.ts`.
  - Lookup matched mock player names / ids.
  - Submit posted to `/api/player-submissions`, which can create `PlayerProfileSubmission` records.
- Existing persistence review:
  - `PlayerProfileSubmission` exists in Prisma.
  - `/api/player-submissions` persists profile submission records.
  - Full claim approval workflow was not implemented or changed in this task.
- New live lookup source:
  - `/claim` now calls `/api/search?q=...`.
  - It filters the live public search response to `Player` results only.
  - It shows live player name, program/school context, age group / gender context, public rank label when available, rating when available, and public profile link.
  - It does not show internal IDs or Game UID values.
  - Deleted / archived players are excluded by the existing live search helper.
- Claim action behavior:
  - The `/claim` form is now non-writing.
  - It does not call `/api/player-submissions`.
  - It displays a clear "claim review workflow is coming soon" / contact-next-step message.
  - It does not create or update Player, PlayerProfileSubmission, Game, rating, ranking, or admin records.
- UX:
  - Compact live profile selection cards.
  - Clean no-result and loading states.
  - Mobile-friendly stacked layout.
- Verification:
  - Source check found no `mock-data` usage in `src/app/claim/page.tsx`.
  - Source check found no `/api/player-submissions` call in `src/app/claim/page.tsx`.
  - TypeScript passed with `npx.cmd tsc --noEmit`.
- No database writes, claim persistence, admin approval workflow, auth logic, schema changes, migrations, Premium/licensed changes, imports/publish, rating recomputes, snapshots, formula changes, or file deletions were performed.

## MVP Navigation Visibility Cleanup Checkpoint

- MVP navigation visibility cleanup completed.
- Main public navigation continues to promote MVP-ready surfaces:
  - Home via brand mark.
  - Rankings.
  - Teams.
  - Leagues.
  - About.
  - How We Rank.
  - FAQs.
  - Submit Stats / portal login flow.
- Footer now promotes:
  - Rankings.
  - Teams.
  - Leagues.
  - About.
  - How We Rank.
  - FAQs.
  - Privacy Policy.
  - Terms of Use.
- Deferred routes remain retained but unpromoted:
  - `/licensed`.
  - `/partner`.
  - `/careers`.
  - `/players/search`.
- The visible `/partner` link on the portal login page was replaced with neutral admin-approved organizer-access copy.
- Underlying routes/code remain intact:
  - No routes were deleted.
  - `PremiumGate` remains in the codebase.
  - `/licensed`, `/partner`, `/careers`, `/players/search`, `/apply`, `/organizer/apply`, and redirect-only legacy routes remain available for future decisions.
- Link scan notes:
  - Remaining `/partner` matches are redirect routes (`/apply`, `/organizer/apply`), not nav/footer promotion.
  - Remaining `/players/search` match is an unused legacy `HeaderPlayerSearch` component and the route itself.
  - Claim Profile links remain because `/claim` now uses live lookup and is part of player-profile UX.
- TypeScript passed with `npx.cmd tsc --noEmit`.
- No files/routes were deleted, and no auth logic, portal/organizer backend, Premium/licensed implementation, database, schema, import/publish, rating/ranking formula, recompute, or snapshot behavior changed.

## Public UI LinkedIn Polish Checkpoint

- Public UI LinkedIn polish pass completed.
- Goal was to make the MVP feel less AI/component-generated and more like a compact sports rankings/database site.
- Homepage changes:
  - Hero height and board-leader card were reduced.
  - Pitch-style explainer sections were replaced with content-led modules.
  - Homepage now prioritizes:
    - Top player board preview.
    - Live team standings preview.
    - Coverage snapshot.
    - Short methodology/data-source strip.
  - Orange remains an accent instead of dominating every module.
- Rankings page changes:
  - Player rankings hero height/title size reduced.
  - Gender and age-group controls tightened.
  - Filter labels are less uppercase-heavy.
  - Ranking table rows, image blocks, rank typography, and rating cells are denser.
- Team Rankings changes:
  - Team rankings hero height/title size reduced.
  - Filters and summary strip tightened.
  - Team standings table rows are denser.
  - Long team names use tighter typography and natural wrapping/truncation where useful.
- Game detail changes:
  - Giant team-name hero was replaced with a compact scoreboard layout.
  - Scores remain prominent.
  - Team names are readable but no longer take over the viewport.
  - Game metadata is in a compact row.
- Team profile changes:
  - Hero panel reduced in height.
  - Team identity, record, roster, and recent results sections are tighter.
  - Roster and game-list rows are denser.
- Player profile changes:
  - Shared `ProfileModule` styling is flatter and more compact.
  - Recent Form, League History, Player Analytics, Player Intelligence, Shooting Profile, Signature Performance, Advanced Metrics, Game Highs, and Game Log chrome were tightened.
  - Repetitive uppercase labels and explanatory text were reduced where safe.
  - Analytics modules now read more like sports profile/stat modules than generic SaaS cards.
- TypeScript passed with `npx.cmd tsc --noEmit`.
- No database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, rating recomputes, snapshots, admin workflow changes, Premium/licensed changes, route deletion, or file deletion were performed.

## Public UI Manual QA Cleanup Checkpoint

- Focused public UI/content cleanup completed from manual QA.
- Navigation:
  - Top nav label changed from `Rankings` to `Players` while keeping the `/rankings` destination.
  - Teams dropdown now promotes `Team Standings` only.
  - `Team Profiles` was removed from Teams dropdown/mobile nav.
  - Footer public link label changed from `Rankings` to `Players`.
- Player Rankings:
  - Removed redundant board subtext about live ratings.
  - Removed public summary text for `Live ratings` and `Historical snapshot`.
  - Added pagination for public rows:
    - up to 300 ranks shown.
    - 100 players per page.
    - canonical rank labels remain based on the full public board, not the page index.
  - Ranking table columns were tightened so the Athlete column no longer creates excessive empty space before Height / Position / Rating.
  - Player rows no longer display region as if it were hometown; city displays only when available.
- Team Rankings:
  - Default view is now `U19` / `Boys` / `All` leagues.
  - No league, including PYBC, is special-cased as the public default.
  - Removed redundant team-board subtext.
  - W-L display now uses compact `W 8 | L 4` style spacing instead of crowded adjacent pills.
- Game detail / public game lists:
  - Removed decorative `Back to league` link from the game detail hero.
  - Removed public game verification/status metadata from game detail.
  - Removed public box-score validation badges such as player-points-vs-score matched checks.
  - Public game list cards no longer show backend verification status labels.
- How We Rank:
  - Removed Formula v2 / preview / internal version discussion from public methodology.
  - Removed PYBC-specific public examples.
  - Kept public explanation focused on data sources, rating basis, age groups, eligibility, team rankings, star bands, corrections, and limits.
- About:
  - Vision copy no longer uses the word `compared`.
  - Copy was shortened and made more direct.
  - Mission / vision and audience sections use fewer boxed/card treatments.
- No database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, rating recomputes, snapshots, admin workflow changes, Premium/licensed changes, route deletion, or file deletion were performed.

## Public Table Sorting and Homepage Polish Checkpoint

- Focused public UI/table/navigation/homepage polish completed from manual QA.
- Homepage:
  - Hero headline updated to `Elevating PH Basketball Through Data`.
  - Subheadline updated to `The nationwide basketball player ranking and visibility platform for young Filipino athletes.`
  - Board leader card now cycles through available age/gender board leaders.
  - Player images display when available; initials fallback remains for players without images.
- Navigation:
  - Desktop Teams and Leagues dropdowns were removed.
  - Top navigation is now simpler: Players, Teams, Leagues, About.
  - Underlying Teams and Leagues routes remain intact.
- Public tables:
  - Player Rankings headers are sortable by Rank, Athlete, Height, Position, and Rating.
  - Team Rankings headers are sortable by Rank, Team, Record, Win %, PF, PA, Diff, and League.
  - Player profile Full Game Log headers are sortable by Date, Opponent, Result, PTS, REB, AST, STL, BLK, and Box.
  - Public box score tables are sortable by Player, MIN, PTS, REB, AST, STL, BLK, TO, PF, FG, 2P, 3P, and FT.
  - Team profile roster table is sortable by Player, Position, Class, Height, GP, PPG, RPG, and APG.
  - Sort indicators use compact text-safe markers, and text columns remain left-aligned while stat columns are centered.
- Player Rankings:
  - Athlete / Height / Position / Rating columns were tightened to reduce the large empty gap after athlete names.
  - Canonical rank labels are preserved when sorting or paginating.
- Team records:
  - Public team record displays continue to use compact `W 8 | L 4` style spacing.
  - Team profile current-record display now matches the same W-L visual pattern.
- Public game detail:
  - Public box score tables no longer show the decorative `Box Score` label or top-right score badge.
  - Public box-score validation badges remain removed from public surfaces.
- No database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, recomputes, snapshots, admin workflow changes, Premium/licensed changes, route deletion, or file deletion were performed.

## Public Rankings Table and Board Leader Carousel Fix Checkpoint

- Focused public rankings/table/homepage fixes completed after manual QA.
- Player Rankings:
  - Exact numeric ratings are hidden for public banded ranks above 100.
  - Banded rows such as `#101-150` now show stars with a muted dash in the numeric rating slot.
  - Exact ratings remain visible for ranks `#1` through `#100`.
  - Athlete / Height / Position / Rating columns now use controlled fixed desktop widths so the Athlete column no longer stretches into a large empty gap.
  - Canonical rank labels remain preserved when sorting or paginating.
- Public box score tables:
  - Sortable stat headers now include MIN, PTS, REB, AST, STL, BLK, TO, PF, FD, +/-, FGM/FGA, 2PM/2PA, 3PM/3PA, and FTM/FTA.
  - Team total rows remain separate and are not included in row sorting.
  - Numeric/stat headers and body cells are centered consistently.
- Table alignment:
  - Identity columns such as Athlete, Team, and Player remain left-aligned.
  - Numeric/stat columns are centered across the updated public tables.
- Homepage:
  - Board leader carousel was redesigned as a wider editorial sports-profile card.
  - Carousel now sits directly under the main hero copy and above homepage preview sections.
  - Card shows player photo/cutout when available without placing real photos on an orange placeholder.
  - Initials fallback remains for players without photos.
  - Card includes board label, player name, program, rating/stars, height, class, age, and game count where available.
  - Large frameless left/right arrow controls sit outside the card.
  - Carousel cycles through available age/gender board leaders.
- Team record display:
  - Homepage team preview records also use compact `W 8 | L 4` style spacing.
- No database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, recomputes, snapshots, admin workflow changes, Premium/licensed changes, route deletion, or file deletion were performed.

## Public Rankings and Homepage Visual Refinement Checkpoint

- Focused visual refinement completed for the public Player Rankings page and homepage.
- Player Rankings:
  - Rankings table now renders as a constrained sports-board panel instead of a full-width white area with unused blank space.
  - Desktop columns use controlled widths for Rank, Athlete, Height, Position, and Rating.
  - Exact numeric ratings remain hidden for banded public ranks above 100.
  - Stars remain visible for banded rows.
- Homepage:
  - Hero area was tightened slightly so the board leader module sits higher in the first viewport.
  - Board leader carousel now uses a darker editorial sports-profile layout inspired by recruiting/player profile cards.
  - Board leader cards no longer show numeric player ratings; they show stars only.
  - Card structure now includes:
    - dark identity strip with rank, player name, program, and board label
    - image/cutout panel or initials fallback
    - compact height, age, class, position, stars, and verified-game context
    - profile and board links
  - Carousel uses slide/fade animation when moving left or right.
  - Arrow controls scale on hover and remain outside the card without filled frames.
- No database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, recomputes, snapshots, admin workflow changes, Premium/licensed changes, route deletion, or file deletion were performed.

## Final Public Manual QA Correction Batch

- Final public UI correction batch applied from manual QA.
- Homepage:
  - Hero copy is centered and shortened around `Elevating PH Basketball Through Data`.
  - Board leader carousel sits directly below the hero copy and above the site stats strip.
  - Carousel cycles through available age/gender board leaders with slide/fade motion.
  - Board leader cards now use a dark identity strip, image/cutout or quiet initials fallback, compact info blocks, stars, and real PPG/RPG/APG averages.
  - Numeric player ratings and verified-game counts were removed from the homepage board leader card.
- Player Rankings:
  - Rankings table is constrained to a compact sports-board width.
  - Athlete / Height / Position / Rating columns use controlled widths to remove the large athlete-to-height gap.
  - Banded public ranks above 100 hide exact numeric ratings and show stars with a muted dash.
- Public tables:
  - Shared sort indicators now use compact triangular markers instead of text arrows.
  - Player Rankings, Team Rankings, Team roster tables, box score tables, and player profile game logs use aligned stat columns.
  - Player profile Full Game Log now supports sorting by MIN, PTS, REB, AST, STL, BLK, TO, PF, FG, 2P, 3P, FT, +/-, and box efficiency.
  - Box score tables keep team totals separate from sortable player rows.
- Player profile:
  - Missing profile metadata is hidden instead of shown as noisy `Not listed` fields where safe.
  - Position rank is hidden when no known position/rank exists.
  - Recent Form copy is shorter.
  - `Player Intelligence` was renamed to `Profile Strengths` and now shows the primary role, badges, and top strength bars only.
  - `Signature Performance` was renamed to `Best Game`.
  - Ranking Trend is hidden when there is not enough real trend history.
  - Full Game Log opponent display is cleaner.
- Content and league pages:
  - Leagues page uses a denser competition list treatment.
  - About and How We Rank copy was tightened into shorter public-facing sports-platform language.
  - Public methodology avoids internal Formula v2/version discussion.
- No database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, recomputes, snapshots, admin workflow changes, Premium/licensed changes, route deletion, or file deletion were performed.

## Homepage Final Polish Checkpoint

- Focused homepage-only polish completed.
- Centered hero direction was retained with the approved headline `Elevating PH Basketball Through Data`.
- Approved subheadline was retained: `The nationwide basketball player ranking and visibility platform for young Filipino athletes.`
- Hero first fold now stays cleaner and taller; the board leader carousel is no longer forced fully above the fold.
- The stats strip remains in the hero as the live data signal.
- Removed the defensive `Live database, not a pitch deck.` copy.
- Board leader carousel is now a separate second homepage section after the hero.
- Board leader image rendering now matches the player profile direction:
  - Real player images use `object-contain` / bottom alignment on the orange profile-style panel.
  - Transparent/cutout images are not placed on a plain white image box.
  - No-photo players use a quieter initials placeholder.
  - Missing height, class, age, or position fields are hidden instead of shown as `-` / `Not listed`.
- Board leader cards no longer show numeric rating, verified-game count, primary role, or role copy.
- Board leader cards show stars plus up to three meaningful stat averages selected from real available stats:
  - PPG, RPG, APG, SPG, BPG, and Stocks.
  - Weak categories are skipped when stronger meaningful averages exist.
- Homepage order is now:
  1. Hero + stats strip.
  2. Board Leaders carousel.
  3. Top 10 Player Board.
  4. Team Standings preview.
  5. Latest Games.
  6. Short `How the boards are built` section.
- Latest Games / Recent Results was added using existing official active game data:
  - Shows recent official games only.
  - Includes date, competition, teams, scores, and links to game detail.
  - Does not show internal Game UID.
- No Recently Updated Profiles, Featured Players, generic audience explainer cards, or long methodology content were added.
- No database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, recomputes, snapshots, admin workflow changes, Premium/licensed changes, route deletion, or file deletion were performed.

## Player Profile Final Public Polish Checkpoint

- Focused public player profile polish completed.
- Hero/header:
  - Long player names now use a smaller responsive clamp and wrap cleanly.
  - Verified check badge sits at the top-right of the name block instead of interrupting the name line.
  - Missing public metadata such as class, position, and height is hidden instead of shown as `Not listed` / `Not on record` filler.
- Rating panel:
  - Rating and stars were moved higher and tightened.
  - Numeric rating size was increased slightly while keeping stars and verified-game context readable.
  - National Rank and Region Rank remain visible when available.
  - Position Rank remains hidden when no position/rank exists.
- Recent Form:
  - Removed public trend labels such as `Heating Up` / `Cooling`.
  - Removed explanatory baseline copy and kept the compact latest-5 stat/table view.
- Profile Strengths:
  - Public section uses `Profile Strengths`.
  - Keeps primary strength, badges, and top percentile bars.
  - Removed internal comparison/rule phrasing from the visible UI.
- Best Game / Advanced Metrics:
  - Best Game uses cleaner public wording.
  - `Peach Basket Box Efficiency` / `Box Efficiency` visible labels were replaced with `Box Impact`.
  - `Stocks` labels were replaced with clearer `STL+BLK` wording where shown.
- Ranking Trend remains hidden when there is not enough real trend history.
- Full Game Log remains filterable/sortable with horizontal scroll and cleaner opponent display.
- No data queries, rating/ranking formulas, admin workflows, database writes, schema changes, recomputes, snapshots, imports/publish, Premium/licensed behavior, route deletion, or file deletion were changed.

## Homepage Focused Refinement Checkpoint

- Focused homepage refinement completed after latest visual QA.
- Hero:
  - Centered hero direction retained.
  - Approved headline and subheadline retained.
  - Headline size was reduced slightly so it stays powerful without overpowering the first fold.
  - Board leader carousel remains the second section after the hero/stats, not forced fully above the fold.
- Stats strip:
  - Stats now render as one centered compact strip:
    - ranked players
    - leagues
    - games
  - Removed the separated box feel that made the strip look off-center.
- Board leader carousel:
  - Card spacing was tightened.
  - Black header strip remains with rank, player name, school/program, and board label.
  - Real player photos now render on a neutral image field with `object-contain` / bottom alignment instead of the orange placeholder/grid background.
  - No-photo players use a quieter initials placeholder.
  - Missing details are hidden rather than shown as `-` / `Not listed`.
  - Numeric ratings and verified-game counts remain hidden.
  - Best three meaningful stat averages are selected from available box-score averages instead of forcing PPG/RPG/APG.
  - Compact profile strength badges were added from real stat-derived signals.
- Homepage Top 10 player board:
  - Structure retained.
  - Preview rows now use compact dashes for missing height/position.
  - Location line was removed from the homepage preview.
- Team Standings Preview:
  - Now shows the Top 5 teams only.
  - W-L display remains `W ... | L ...`.
- Latest Games:
  - Kept as the live database signal.
  - Removed duplicated final-score text; score now appears only in the stacked team-score format.
  - Competition labels use shorter public display names where recognized.
- `How the boards are built` remains short and homepage-appropriate.
- No database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, recomputes, snapshots, admin workflow changes, Premium/licensed changes, route deletion, or file deletion were performed.

## Homepage Hero and Board Leader Card Refinement Checkpoint

- Focused homepage hero and board leader carousel refinement completed.
- Hero first-fold behavior:
  - Centered hero layout retained.
  - Approved headline `Elevating PH Basketball Through Data` retained.
  - Approved subheadline retained.
  - Hero keeps a first-screen min-height so the first fold feels complete.
  - Board leader carousel begins after the hero as the second homepage section and should not peek into the normal desktop first fold.
- Stats strip:
  - Restored the preferred substantial three-column stat strip under the CTA buttons.
  - Dynamic ranked-player, league, and game counts remain.
  - Strip is centered and visually tied to the hero instead of using the tiny inline sentence style.
- Board leader carousel:
  - Carousel remains the second section after scrolling.
  - Arrows remain outside the card, frameless, thick, and background-free.
  - Card was redesigned closer to a sports profile-card reference without copying it directly.
  - Dark header bar now carries rank, player name, school/program, and board label hierarchy.
  - Main body separates a stronger left athlete/profile card from a right feature summary area.
- Player image handling:
  - Real player images render on a neutral field with `object-contain` / bottom alignment.
  - Real images no longer use the orange placeholder/grid background.
  - No-photo players use a softer initials fallback with a subtle branded grid.
  - Missing height, age, class, or position fields remain hidden.
- Board leader details:
  - Numeric rating and verified-game count remain hidden.
  - Right summary uses star line, best meaningful stat averages, and profile strength badges.
  - Best three meaningful stats continue to be selected from real box-score averages instead of forcing PPG/RPG/APG.
  - Up to four compact profile strength badges are shown from real stat-derived signals.
- Existing homepage content after the carousel remains:
  - Top 10 player board.
  - Team Standings Preview.
  - Latest Games.
  - How the Boards Are Built.
- No database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, recomputes, snapshots, admin workflow changes, Premium/licensed changes, route deletion, or file deletion were performed.

## Public Player Profile Box Impact Cleanup Checkpoint

- Focused public player profile cleanup completed.
- Public verified/check icon was removed from the player profile hero name area.
- Box Impact / Peach Basket Box Efficiency is hidden from public player profile UI.
- Box Impact remains available internally where existing code uses it for private calculations or Best Game selection.
- Recent Form:
  - Removed `Box` from the latest-5 stat strip.
  - Removed the public Score/Box column from the latest-5 table.
  - Kept familiar latest-5 PPG/RPG/APG and PTS/AST/REB table display.
- Best Game:
  - Removed `Box Score Highlight` label.
  - Removed visible Box Impact value/badge.
  - Best Game now shows opponent, competition/date, familiar statline, and shooting line only.
- Game Highs:
  - Removed Box Impact high.
  - Kept familiar highs: points, rebounds, assists, steals, blocks, and STL+BLK.
- Advanced Metrics:
  - Removed Box Impact card from public display/data.
  - Kept familiar metrics such as eFG%, TS%, AST/TO, PTS/MIN, REB/MIN, and STL+BLK when inputs exist.
- League History:
  - Removed Box/Box Impact summary metric.
  - League cards now show competition/season/games and familiar PPG/RPG/APG averages.
- Full Game Log:
  - Removed Box Impact / Score sort option.
  - Public columns remain Date, Opponent, Result, MIN, PTS, REB, AST, STL, BLK, TO, PF, FG, 2P, 3P, FT, and +/-.
- No database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, recomputes, snapshots, admin workflow changes, Premium/licensed changes, route deletion, or file deletion were performed.

## Filtered Homepage Polish Checkpoint

- Focused homepage-only polish completed from the latest visual QA.
- Hero first-fold behavior:
  - Approved headline `Elevating PH Basketball Through Data` remains unchanged.
  - Approved subheadline remains unchanged.
  - Hero is kept as a complete first-screen section.
  - Board leader carousel starts after the hero as the second homepage section and should not peek into the normal desktop first fold.
- Stats strip:
  - Restored/preserved the substantial centered three-column strip for ranked players, leagues, and games.
  - The tiny inline stat-strip treatment was not used.
- Board leader carousel:
  - Carousel card was tightened to reduce excessive vertical height and beige empty space.
  - Arrows remain outside the card, frameless, thick, and background-free, with subtle hover movement.
  - Dark header bar keeps rank, player name, school/program, and board label hierarchy.
  - Real player photos render on a neutral image field with `object-contain` / bottom alignment.
  - No-photo players use a quieter initials placeholder.
  - Missing height, age, class, and position fields remain hidden instead of showing `-` / `Not listed`.
  - Numeric rating and verified-game count remain hidden.
  - Right feature area shows star label, stars, best meaningful stat averages, and compact strength badges from existing data.
- Top 10 player board:
  - Homepage preview row spacing was tightened.
  - Athlete-to-height spacing was reduced with controlled preview columns.
  - Missing height/position continue to use compact dashes.
  - Location lines remain removed from the homepage preview.
- Team Standings Preview:
  - Remains a Top 5 section.
  - W-L display remains `W ... | L ...`.
- Latest Games:
  - Kept as the live database signal.
  - Rows now use compact scoreboard-style cards with date, short competition label, stacked teams, aligned scores, and winner emphasis.
  - Internal Game UID remains hidden.
- `How the boards are built` remains short with the approved copy.
- No database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, recomputes, snapshots, admin workflow changes, Premium/licensed changes, route deletion, or file deletion were performed.

## Homepage First-Fold Height Fix Checkpoint

- Focused homepage first-fold height fix completed.
- Hero section now uses a full viewport-height minimum so the fixed navbar no longer causes the hero to end early.
- Board leader carousel remains the second homepage section and is no longer intentionally allowed to peek into the first fold.
- Homepage headline, subheadline, CTA buttons, stat strip, carousel design, board leader data, Top 10 table, Team Standings, Latest Games, and other public routes were not redesigned or changed.
- No database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, recomputes, snapshots, admin workflow changes, Premium/licensed changes, route deletion, or file deletion were performed.

## Admin Shell and Dashboard Revamp Checkpoint

- Batch 1 admin UI revamp completed for the admin shell and `/admin` dashboard only.
- Admin shell is now separated from the public-style navigation:
  - `/admin` routes no longer show the public Players / Teams / Leagues / About / Submit Stats / Login navbar as the main header.
  - Admin routes use a compact `Peach Basket Admin` top bar with public-site and sign-out links.
  - Public routes keep the existing public Navbar and Footer.
- Admin sidebar was compacted and organized into:
  - Overview.
  - Workflows.
  - Data Management.
  - Tools.
  - Account.
- Sidebar active states remain clear and existing admin pages continue to pass their existing active keys.
- `/admin` dashboard was converted toward a compact operations console:
  - smaller page header.
  - operational stat tiles.
  - latest updated submission row.
  - quick actions.
  - compact data-health summary.
  - reference links.
- No submission detail UI, submission workflow, Program Management page, manual stats/live stats tool behavior, backend action handlers, auth behavior, database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, recomputes, snapshots, Premium/licensed behavior, route deletion, or file deletion were performed.

## Admin Submission Queue Revamp Checkpoint

- Batch 2 admin UI revamp completed for `/admin/submissions` queue only.
- `/admin/submissions` was converted toward a compact operations-console queue:
  - smaller page header.
  - tighter search/status filter row.
  - desktop table-like submission list.
  - compact stacked mobile/tablet rows.
- Admin JSON Intake remains available but is visually de-emphasized behind a compact collapsed section.
- Status and readiness badges were tightened for faster scanning.
- Existing submission actions still point to the same detail route and preserve the prior action labels.
- No `/admin/submissions/[id]` detail UI, publish/import/re-parse workflow, backend action handlers, Program Management, manual stats/live stats tools, public UI, auth behavior, database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, recomputes, snapshots, Premium/licensed behavior, route deletion, or file deletion were changed.

## Admin Submission Queue Layout Fix Checkpoint

- Batch 2.1 layout fix completed for `/admin/submissions` queue only.
- Desktop queue now uses an internal horizontal scroll/min-width layout so the rightmost Action column is not clipped by the admin content area.
- Player rows and Status columns were given clearer fixed spacing to prevent header collision.
- Queue badge display labels were shortened for scanning:
  - `READY FOR ADMIN CLEANUP/IMPORT` displays as `Ready for import`.
  - `IMPORTED` displays as `Imported`.
  - review-oriented labels display as `Needs review`.
- Queue rows were tightened with smaller badge padding, smaller row padding, and no normal desktop badge wrapping.
- `Back to Admin` was removed because Dashboard is already available in the admin sidebar.
- Page header padding was reduced slightly so the queue gets visual priority.
- No `/admin/submissions/[id]` detail UI, publish/import/re-parse workflow, backend action handlers, Program Management, manual stats/live stats tools, public UI, auth behavior, database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, recomputes, snapshots, Premium/licensed behavior, route deletion, or file deletion were changed.

## Admin Submission Detail Workflow Revamp Checkpoint

- Batch 3 admin UI revamp completed for `/admin/submissions/[id]` only.
- Submission detail now uses a clearer step-based review flow:
  - Submission Overview.
  - Parsed Games / Editable Review.
  - Validation & Warnings.
  - Safe Admin Actions.
  - Final Publish / Import.
  - Audit / Pipeline / Metadata.
- A compact sticky workflow nav was added for the main review sections.
- Header, status badges, overview tiles, parsed game cards, and player stat tables were tightened for operations-console scanning.
- Imported submissions now show clearer read-only messaging in the review flow.
- High-impact publish/import controls are visually separated in a red guarded zone with explicit confirmation copy.
- Audit, pipeline, preflight, metadata, stored JSON, and debug-style sections are contained or collapsed so they do not dominate the review workflow.
- No `/admin/submissions` queue, backend action handlers, publish/import/re-parse logic, data shape, Program Management, manual stats/live stats tools, public UI, auth behavior, database writes, schema changes, migrations, imports/publish execution, rating/ranking formula changes, recomputes, snapshots, Premium/licensed behavior, route deletion, or file deletion were changed.

## Admin Program Management UI Revamp Checkpoint

- Batch 4 admin UI revamp completed for `/admin/programs` and `/admin/programs/[id]` only.
- `/admin/programs` was compacted into an admin directory:
  - smaller page header.
  - active program count badge.
  - tighter search/type filters.
  - denser table-like rows with Program, abbreviation, type, teams, players, games, status, and action.
- `/admin/programs/[id]` was reorganized into a compact roster/program workspace:
  - smaller detail header with key counts.
  - sticky section nav for Overview, Teams, Roster, Graduated, Historical, Assignment, and Advanced.
  - current Teams/Monikers and current roster sections are prioritized.
  - Team-to-Program assignment was moved lower and kept collapsed behind guardrail copy.
- Current roster rows and player tool accordions were tightened so player edit/profile/photo tools remain available without dominating the page.
- Graduated players remain separated and accessible.
- Legacy roster review and historical stat evidence remain accessible but visually secondary/collapsed where appropriate.
- Roster assignment selector guardrails and confirmation copy remain intact.
- No backend action handlers, roster transfer/reassignment behavior, player edit/photo upload behavior, Program/Team server actions, Team/GameStat/Game relationship logic, database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, recomputes, snapshots, public UI, auth behavior, Premium/licensed behavior, route deletion, or file deletion were changed.

## Admin Tools UI Revamp Checkpoint

- Batch 5 admin UI revamp completed for `/admin/tools/submissions` and `/admin/tools/live-stats`.
- `/admin/tools/submissions` was compacted into an operations-console tools page:
  - smaller page header.
  - tighter upload/manual-entry panels.
  - compact spreadsheet form controls.
  - denser Recent Submissions table with status badges.
- `/admin/tools/live-stats` now uses the compact admin shell and embedded manual stats presentation:
  - smaller admin header.
  - tighter game detail, team score, player stat, and validation sections.
  - dense stat tables with stronger header contrast.
- Existing upload, manual stats, validation, and draft-submission actions were not changed.
- No parser/upload/manual stat/live stats extraction logic, form/server action behavior, import/publish workflow, backend data shape, database writes, schema changes, migrations, recomputes, snapshots, rating/ranking formula changes, public UI, submission queue/detail UI, Program Management UI, auth behavior, Premium/licensed behavior, route deletion, or file deletion were changed.

## Admin Simplification / Reduce Clutter Checkpoint

- Batch 6 admin UI simplification completed.
- Admin sidebar was reorganized into:
  - Daily Work: Dashboard, Submissions, Programs, Manual Stats Entry.
  - Support: Player Search, Rankings / Data Health, Player Duplicate Review.
  - Advanced: Submission Tools, Internal Teams.
  - Account: Sign out.
- Program Detail was reduced toward a Teams / Roster / Graduated / Advanced workflow.
- Sticky Program Detail navigation now uses only Overview, Teams, Roster, Graduated, and Advanced.
- Repeated section `Open` / `Hide` pills were removed from Program Detail section headers.
- Current Teams / Monikers now use a compact table-like list with inline `Edit` expansion instead of large edit cards.
- Current Roster rows now use a compact scan table with Player, Gender, Class, Position, Height, Team, Warnings, and Tools.
- Player profile/media/roster tools remain available behind each player's compact `Tools` action instead of appearing as full-width tool accordions on every row.
- Graduated players remain separated from current roster and editable.
- Legacy roster review, historical stat evidence, unassigned players, Team-to-Program assignment, and diagnostics were de-emphasized as collapsed Advanced areas.
- Copy was tightened to short operational guardrails such as `Metadata only. No stat moves.`
- No backend action handlers, server actions, form submission behavior, roster assignment logic, player edit/photo behavior, Program/Team relationship logic, database writes, schema changes, migrations, imports/publish, rating/ranking formula changes, recomputes, snapshots, public UI, submission workflow behavior, manual stats/parser behavior, auth behavior, Premium/licensed behavior, route deletion, or file deletion were changed.

