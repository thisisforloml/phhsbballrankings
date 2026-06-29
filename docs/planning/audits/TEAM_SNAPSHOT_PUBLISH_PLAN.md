# Team Snapshot Publish Plan (Prepared — Do Not Execute)

**Status:** Not ready for production publish  
**Blocker:** DRAFT snapshots not yet persisted in staging DB  
**Prerequisite:** F3 from `TEAM_RANKINGS_LAUNCH_BLOCKER_SWEEP.md`

---

## Readiness

| Gate | Status |
|---|---|
| Builder parity (read-only dry-run) | **PASS** (14/14) |
| Immutability guards | **PASS** |
| DB DRAFT snapshots exist | **NO** |
| Staging publish trial | **NO** |

**Snapshot Publish: NOT READY**

---

## Phase 1 — Staging DRAFT (when approved)

```bash
TEAM_SNAPSHOT_PUBLISH_ENABLED=true npx tsx scripts/generate-team-ranking-snapshots.ts
```

Expected: 4 boards → DRAFT snapshots (U13 Boys, U16 Boys, U19 Boys, U19 Girls)

Validate:

```bash
npx tsx scripts/validate-team-ranking-snapshots-tr7.ts
```

Expect V-TR-31 through V-TR-37: **PASS** (not SKIP)

---

## Phase 2 — Staging Publish Trial (when approved)

```bash
TEAM_SNAPSHOT_PUBLISH_ENABLED=true npx tsx scripts/generate-team-ranking-snapshots.ts --publish
```

Verify:

- Prior DRAFT → PUBLISHED
- `rowCount` matches live eligible board
- Re-run skips published month (forward-only)
- Prior published months → SUPERSEDED

---

## Phase 3 — Production (prepared, do not execute)

```bash
# 1. Enable flag
TEAM_SNAPSHOT_PUBLISH_ENABLED=true

# 2. Restart application

# 3. Generate + publish (first month only)
npx tsx scripts/generate-team-ranking-snapshots.ts --publish
```

---

## Rollback

```bash
TEAM_SNAPSHOT_PUBLISH_ENABLED=false
```

Existing PUBLISHED snapshots remain read-only historical records. No automatic public surface consumes team snapshots yet (Rev 2 forward-looking).

---

## Row Counts Expected (current data)

| Board | Public-eligible rows |
|---|---:|
| U13 Boys | 8 |
| U16 Boys | 16 |
| U19 Boys | 30 |
| U19 Girls | 2 |
