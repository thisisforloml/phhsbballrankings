# Platform Gap Matrix

Maps requirements from **PLATFORM OVERVIEW.pdf** to current implementation per `docs/PROJECT_STATUS.md` and codebase.

| Requirement | Overview intent | Current state | Gap | Priority |
| --- | --- | --- | --- | --- |
| Nationwide youth rankings | PH-wide player/team visibility | Live public boards, UAAP + PYBC data | Coverage still limited to imported leagues | Medium |
| Age groups U13/U16/U19 | Boys + Girls brackets | Official groups enforced; June 1 rollover | U13/U16 boards less populated than U19 | Medium |
| Player eligibility | Boys 10+ games, Girls 5+ games | Enforced on public boards | U13/U16 min-game rules not fully documented in UI | Low |
| Daily ranking updates | Boards refresh when data published | Live `PlayerRating` on publish | Not a scheduled daily job; updates on import/publish | Low |
| Team rankings | W-L standings by age/gender | `/teams` full-competition view | Team **ratings** (quality score) not public | Medium |
| Program vs Team model | Programs admin-only; teams ranked | `Program` / `Team` separation enforced | PYBC repair done; 23 blocked roster rows remain | High |
| League tiers (1–4) | Rated, promotable/demotable | Tier labels on league history | No tier governance workflow or promotion rules | High |
| Player rating factors | Box score, opponent, team context, advanced | Formula v1 production | Opponent/team context neutral in v1; v2 preview only | High |
| Team rating factors | Player quality, PD, PA, league tier | Standings from games | `TeamRating` preview admin-only; not aligned to overview | Medium |
| Age progression | U13→U16→U19 at 14/17 | June 1 rollover after May 31 | Carryover rating **not implemented** | High |
| Class year / graduation | Remove after class year May 31 | `classYearOverride` + live board filter | PDF examples differ slightly from March 31 rule in status | Low |
| Transfer workflow | Admin transfer; rating retained | `PlayerTeamSeason` + guarded transfer | Historical vs current display still confusing | Medium |
| Graduated searchability | Profile searchable after removal | Profiles remain; rankings filtered | Works; needs claim workflow polish | Low |
| Player profile fields | Photo, school, ranks, stats, scouting | Rich analytics modules | **Scouting report** and **compare** were missing (now planned/implemented) | High |
| Interactive analytics | Performance visualization | Tables + bars | **Interactive SVG charts** added in roadmap implementation | High |
| Global search | Find players/teams/leagues | Live `/api/search` | Team profile discoverability reduced in nav | Low |
| Claim profile | Player self-service | Live lookup; non-writing form | Approval workflow not built | Medium |
| Admin player edit | Bio, transfer, photo | Program detail + players admin | Cluttered; overhaul in progress | High |
| Admin team/league/program edit | Identity management | Programs, teams, submissions | Scattered across routes | High |
| Stats submission | JSON, Excel/CSV, manual, URL | JSON, spreadsheet, manual, URL import | URL import separate from main inbox | Medium |
| Premium/licensed | Future model | Deferred; routes unlinked | Product decision pending | Low |
| Formula v2 | Richer AI-informed scoring | Preview/dry-run only | **Schema blocker** for side-by-side storage | Critical |
| Legal pages | Privacy, terms | Draft placeholders | Lawyer review needed | Medium |

## Legend

- **Critical**: blocks product direction until resolved
- **High**: material gap vs overview or ops risk
- **Medium**: partial implementation or polish
- **Low**: minor copy, coverage, or deferred product surface
