# Legacy Administrative API Migration Report

Date: 2026-06-28

## Phase 1 — Investigation

### Legacy endpoints (removed)

| Endpoint | Methods | Functionality |
|----------|---------|---------------|
| `/api/administrator/requests` | `POST` | List latest 50 `PlayerProfileSubmission` + `OrganizerApplication` rows |
| `/api/administrator/requests` | `PUT` | Approve/reject player submissions; approve/reject organizer applications (create organizer user on approve) |
| `/api/owner/requests` | `POST` | Same list as administrator `POST` (read-only subset) |

**Authentication (legacy):** JSON body field `username` matched against `User` with `role: ADMIN`. No password, no portal session.

**In-repo callers:** None (`fetch` / `sessionStorage` UI was already removed).

### Intake sources (unchanged)

| Public endpoint | Creates |
|-----------------|---------|
| `POST /api/player-submissions` | `PlayerProfileSubmission` |
| `POST /api/organizer-applications` | `OrganizerApplication` |

### Behavior preserved in migration

| Action | Database effect |
|--------|-----------------|
| Reject player submission | `status: REJECTED`, `reviewedAt` set |
| Approve player (linked) | Update existing `Player` bio fields from submission |
| Approve player (new) | `player.create` with placeholder birthDate `2010-01-01`, default position `G`, pending city/region fallbacks |
| Reject organizer | `status: REJECTED`, `reviewedAt` set |
| Approve organizer | `user.upsert` ORGANIZER, `status: APPROVED`, initial password `Organizer123`, username algorithm unchanged |

## Phase 2 — Modern replacement

| New surface | Auth | Audit |
|-------------|------|-------|
| `/admin/intake` page | `requireAdminUser()` + middleware | `writeAuditLog` on every approve/reject |
| `reviewPlayerProfileSubmission` server action | Portal session | `PLAYER_PROFILE_SUBMISSION` entity |
| `reviewOrganizerApplication` server action | Portal session | `ORGANIZER_APPLICATION` entity |

Shared logic: `src/lib/admin/intake-review.ts` (extracted from legacy route handlers).

## Phase 3 — Removal

Deleted:

- `src/app/api/administrator/requests/route.ts`
- `src/app/api/owner/requests/route.ts`

Redirects updated:

- `/administrator` → `/admin/intake`
- Ops tools link → `/admin/intake`
- Claim page copy → `/admin/intake`

## Verification checklist

- [ ] Log in as admin at `/portal/login`
- [ ] Open `/admin/intake` — lists load without error
- [ ] Reject a test player submission — status becomes `REJECTED`, audit log entry appears in `/admin/ops`
- [ ] Approve a test organizer application — organizer user created, success message shows `Login: … · Organizer123`
- [ ] Confirm `POST /api/administrator/requests` returns 404
- [ ] Confirm `POST /api/owner/requests` returns 404
- [ ] `npm run typecheck`, `npm run lint`, `npm run test` pass

## Final admin-related API inventory

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/portal/session` | Portal cookie | Session probe |
| `POST /api/cron/update-ratings` | `CRON_SECRET` | Scheduled ratings job |
| `POST /api/organizer/login` | Password (no session cookie) | API login (no in-repo callers) |
| `POST /api/organizer/games` | Portal cookie | Organizer game submission |
| `POST /api/organizer-applications` | Public | Intake create |
| `POST /api/player-submissions` | Public | Intake create |
| `POST /api/profile-claims` | Public | Profile claim create |
| `POST /api/licensed/access` | Hardcoded account + password | Licensed export (separate track) |
| `POST /api/monitoring/client-error` | Public | Client error reporting |
| Public reads | None | `/api/players`, `/api/rankings`, `/api/search`, profiles |

**Removed:** `/api/administrator/*`, `/api/owner/*`
