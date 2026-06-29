# Team Rankings Production Rollout (Prepared — Do Not Execute)

**Status:** Prepared plan only  
**Prerequisite:** Deploy blocker-sweep code to production  
**Recommendation:** National launch ready; execute when approved

---

## 1. Enable National Rankings

```bash
# Production environment variable
TEAM_NATIONAL_RATINGS_ENABLED=true
```

Keep these **false** until separately approved:

```
TEAM_SNAPSHOT_PUBLISH_ENABLED=false
TEAM_TPI_RECOMPUTE_ENABLED=false
```

---

## 2. Restart Application

Restart the Next.js production process (or redeploy) so server components pick up the env change.

---

## 3. Smoke-Test Checklist

| # | Check | Expected |
|---|---|---|
| 1 | `/teams` loads | National view default; U16 Boys board |
| 2 | National / Competition toggle | Both modes work |
| 3 | Gender toggle | Boys/Girls scopes correctly |
| 4 | Age pills U13/U16/U19 | Board switches; U13/U16 Girls empty state |
| 5 | U19 Girls | 2 programs + sparse banner |
| 6 | Search filter | Canonical ranks preserved (gaps OK) |
| 7 | Sort by TPI | Order changes; rank numbers unchanged |
| 8 | Program link | Navigates to `/teams/[id]` |
| 9 | `/rankings` | Unchanged |
| 10 | `/admin/team-ratings` | Admin preview still works |

---

## 4. Validate Production Behavior

```bash
TEAM_NATIONAL_RATINGS_ENABLED=true npx tsx scripts/validate-team-national-staging-qa.ts
```

Expect: **10 PASS, 0 FAIL**

Monitor:

- No console errors on `/teams`
- `Last computed` timestamp visible in national view

---

## 5. Rollback

If issues arise:

```bash
TEAM_NATIONAL_RATINGS_ENABLED=false
```

Restart application. Public reverts to competition standings only. No data loss.

---

## 6. Post-Launch Notes

- **Do not** enable `TEAM_TPI_RECOMPUTE_ENABLED` until 86-game import linkage is resolved (see blocker sweep F2).
- Persisted ratings reflect pre-filter compute; safe for read-only national display.
