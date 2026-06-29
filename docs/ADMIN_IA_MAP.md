# Admin Information Architecture Map

Phase A deliverable for Workstream 9. Consolidates scattered admin routes into workspaces.

## Workspaces

### 1. Dashboard (`/admin`)

- Operational stat tiles
- Latest submission
- Quick actions
- Data health summary (links to workspace 3)

### 2. Inbox / Review (`/admin/submissions`, `/admin/submissions/[id]`)

**Job:** intake → parse → validate → preflight → publish → verify

| Current route | Future home |
| --- | --- |
| `/admin/submissions` | Inbox queue |
| `/admin/submissions/[id]` | Guided review pipeline |
| `/admin/tools/submissions` (upload) | Inbox → New intake (admin draft) |
| URL import steps | Merged into submission detail or intake wizard |

**Danger zone:** Final publish/import (red guarded zone, impact summary, confirmations).

### 3. Identity (`/admin/programs`, `/admin/identity`)

**Job:** Programs, Teams, Players, Duplicates, Roster

| Tab | Source | Notes |
| --- | --- | --- |
| Programs | `/admin/programs`, `/admin/programs/[id]` | Primary roster workspace |
| Players | `/admin/players` | Search + link to program |
| Teams | `/admin/teams` | Internal team records |
| Duplicates | `/admin/data-health/player-duplicates` | Merge review only |

Redirects: `/admin/programs` remains canonical; identity hub links tabs.

### 4. Data Health (`/admin/data-health`)

**Job:** counts, remediation queues, planner references (read-only)

- Missing birthdates / photos / position
- Programs needing review
- Duplicate player candidates
- Blocked legacy roster rows (23)
- Links to fix screens + `npm run plan:*` docs in `ADMIN_RUNBOOK.md`

### 5. Live Capture (`/admin/tools/live-stats`)

**Job:** manual / live stats entry

Staged scorekeeper: Game setup → Scores → Roster → Review

### 6. Ratings & Rankings (`/admin/team-ratings`, public links)

**Job:** v1 status, team ratings preview, formula v2 gated

- No Formula v2 execute in admin until schema approved

## Navigation model

```
Daily Work
  Dashboard
  Inbox (Submissions)
  Identity (Programs)
  Live Capture

Support
  Data Health
  Player Search
  Public Rankings

Advanced
  Submission Tools (admin draft intake)
  Internal Teams
  Team Ratings Preview
```

## Task frequency vs danger

| Frequency | Danger | Examples |
| --- | --- | --- |
| Daily | Low | Queue review, player bio edit, live capture draft |
| Weekly | Medium | Program roster assignment, re-parse preview |
| Rare | High | Publish/import, duplicate merge execute, repair scripts |

Repair/backfill CLI scripts stay **out of admin UI**; planners surfaced read-only in Data Health.
